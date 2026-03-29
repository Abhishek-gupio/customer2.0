import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { env } from "../config/env";
import axios from "axios";

const db = dbInstances;

const DAMOOV_API_BASE = "https://user.telematicssdk.com/v1";

import { getRedis } from "../config/redis";

const ADMIN_TOKEN_REDIS_KEY = "damoov:admin_token";
const RATE_LIMIT_BACKOFF_REDIS_KEY = "damoov:rate_limit_backoff";
const RATE_LIMIT_BACKOFF_MS = 2 * 60 * 60 * 1000;

function isRateLimitError(err: any): boolean {
  const status = err.response?.status;
  const body = err.response?.data;
  const msg = typeof body === "string" ? body : body?.error || body?.message || "";
  return status === 429 || /rate limit exceeded/i.test(String(msg));
}

async function getDamoovAdminToken(forceLogin?: boolean): Promise<string | null> {
  const redis = getRedis();
  
  if (redis) {
    const cachedToken = await redis.get(ADMIN_TOKEN_REDIS_KEY);
    if (cachedToken) return cachedToken;

    if (!forceLogin) {
      const backoffUntil = await redis.get(RATE_LIMIT_BACKOFF_REDIS_KEY);
      if (backoffUntil && Date.now() < parseInt(backoffUntil, 10)) {
        logger.debug(
          { backoffUntil: new Date(parseInt(backoffUntil, 10)).toISOString() },
          "Skipping Damoov login (rate limit backoff cached in Redis)"
        );
        return null;
      }
    }
  }

  if (!env.DAMOOV_ADMIN_EMAIL || !env.DAMOOV_ADMIN_PASSWORD) {
    return null;
  }

  try {
    const authRes = await axios.post(
      "https://user.telematicssdk.com/v1/Auth/Login",
      {
        LoginFields: JSON.stringify({ email: env.DAMOOV_ADMIN_EMAIL }),
        Password: env.DAMOOV_ADMIN_PASSWORD,
      },
      {
        headers: { accept: "application/json", "content-type": "application/json" },
      }
    );
    const token = authRes.data?.Result?.AccessToken?.Token;
    if (!token) return null;

    if (redis) {
      // TTL set to 50 minutes (3000 seconds)
      await redis.setex(ADMIN_TOKEN_REDIS_KEY, 3000, token);
    }
    return token;
  } catch (err: any) {
    if (isRateLimitError(err)) {
      if (redis) {
        const backoffTime = Date.now() + RATE_LIMIT_BACKOFF_MS;
        await redis.setex(RATE_LIMIT_BACKOFF_REDIS_KEY, 7200, backoffTime.toString());
      }
      logger.warn(
        { error: err.response?.data || err.message, backoffMinutes: 120 },
        "Damoov Admin API rate limited on login; set 2-hour backoff in Redis"
      );
    } else {
      logger.error(
        { error: err.response?.data || err.message },
        "Failed to login to Damoov Admin API"
      );
    }
    return null;
  }
}

export const telematicsService = {
  /**
   * Register a user with Damoov explicitly to get a DeviceToken
   */
  async registerUserWithDamoov(clientCustomId: string) {
    logger.info({ clientCustomId }, "Registering user with Damoov");

    if (!env.DAMOOV_INSTANCE_ID || !env.DAMOOV_INSTANCE_KEY) {
      logger.error("Missing Damoov Instance Credentials in environment");
      throw new Error("Telematics configuration error");
    }

    try {
      const response = await axios.post(
        `${DAMOOV_API_BASE}/Registration/create`,
        {},
        {
          headers: {
            InstanceId: env.DAMOOV_INSTANCE_ID,
            InstanceKey: env.DAMOOV_INSTANCE_KEY,
          },
        }
      );

      // The response.data should contain the DeviceToken
      return response.data;
    } catch (error: any) {
      logger.error(
        { error: error.response?.data || error.message },
        "Damoov user registration failed"
      );
      throw new Error("Failed to register user with Telematics API: " + JSON.stringify(error.response?.data || error.message));
    }
  },
  /**
   * Link a mobile SDK instance to a vehicle.
   */
  async registerDevice(
    vehicleId: string,
    instanceId: string,
    deviceToken?: string,
    platform?: string,
  ) {
    logger.info({ vehicleId, instanceId }, "Linking Telematics Device");

    const payload = { deviceToken, platform, isActive: true };

    const existing = await db.telematicsDevice.findFirst({
      where: {
        OR: [
          { instanceId },
          { vehicleId },
        ],
      },
    });

    if (existing) {
      return db.telematicsDevice.update({
        where: { id: existing.id },
        data: { instanceId, vehicleId, ...payload },
      });
    }

    return db.telematicsDevice.create({
      data: {
        vehicleId,
        instanceId,
        deviceToken,
        platform,
        isActive: true,
      },
    });
  },

  /**
   * Process a webhook from Damoov
   */
  async processWebhook(payload: any) {
    logger.info({ type: payload.type }, "Received Telematics Webhook");

    const {
      InstanceID,
      TripID,
      StartDate,
      EndDate,
      Distance,
      Duration,
      Score_Overall,
      Events,
    } = payload;

    const device = await db.telematicsDevice.findUnique({
      where: { instanceId: InstanceID },
      include: { vehicle: true },
    });

    if (!device || !device.isActive) {
      logger.warn(
        { InstanceID },
        "Webhook received for unknown or inactive device",
      );
      return { status: "ignored", reason: "Device not found" };
    }

    const vehicleId = device.vehicleId;

    const trip = await db.drivingTrip.create({
      data: {
        vehicleId,
        tripId: TripID || `MANUAL_${Date.now()}`,
        startTime: new Date(StartDate * 1000),
        endTime: new Date(EndDate * 1000),
        distanceKm: Distance || 0,
        durationMin: (Duration || 0) / 60,
        safetyScore: Score_Overall || 100,
        status: "COMPLETED",
        events: {
          create: (Events || []).map((e: any) => ({
            eventType: e.Type,
            timestamp: new Date((e.Date || StartDate) * 1000),
            latitude: e.Latitude,
            longitude: e.Longitude,
            severity: e.Value,
            speed: e.Speed,
          })),
        },
      },
    });

    await this.updateVehicleHealth(vehicleId);

    return { status: "success", tripId: trip.id };
  },

  /**
   * Recalculate Vehicle Health based on telematics
   */
  async updateVehicleHealth(vehicleId: string) {
    const recentTrips = await db.drivingTrip.findMany({
      where: { vehicleId },
      orderBy: { startTime: "desc" },
      take: 20,
    });

    if (recentTrips.length === 0) return;

    const avgScore =
      recentTrips.reduce((acc: number, t: any) => acc + t.safetyScore, 0) /
      recentTrips.length;

    await db.vehicleHealthScore.upsert({
      where: { vehicleId },
      update: {
        drivingScore: Math.round(avgScore),
        lastCalculated: new Date(),
      },
      create: {
        vehicleId,
        drivingScore: Math.round(avgScore),
      },
    });
  },

  /**
   * Get Trip History for a Vehicle
   */
  async getTrips(vehicleId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    let trips: any[] = [];
    let total = 0;

    try {
      const [dbTrips, dbTotal] = await Promise.all([
        db.drivingTrip.findMany({
          where: { vehicleId },
          orderBy: { startTime: "desc" },
          take: limit,
          skip,
          include: { events: true },
        }),
        db.drivingTrip.count({ where: { vehicleId } }),
      ]);

      trips = dbTrips;
      total = dbTotal;

      if (typeof total === "number") {
        const latest = trips.length ? trips[0].startTime : null;
        logger.info(
          { vehicleId, totalTrips: total, latestStartTime: latest ? new Date(latest).toISOString() : null },
          "telematics.getTrips result"
        );
      }
    } catch (dbError: any) {
      logger.error({ dbError, vehicleId }, "Database error fetching trips");
      throw new Error("Failed to fetch trips from database");
    }

    if (trips.length) {
      try {
        const device = await db.telematicsDevice.findUnique({
          where: { vehicleId },
        });

        if (device) {
          const ADMIN_INSTANCE_ID_GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const deviceTokenLooksLikeGuid = !!device.deviceToken && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.deviceToken));
          const instanceIdLooksLikeGuid = !!device.instanceId && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.instanceId));
          const candidates = Array.from(new Set([
            deviceTokenLooksLikeGuid ? String(device.deviceToken) : null,
            instanceIdLooksLikeGuid ? String(device.instanceId) : null,
          ].filter(Boolean))) as string[];

          const candidate = candidates[0] || (device.deviceToken ? String(device.deviceToken) : null);
          if (candidate) {
            const accessToken = await getDamoovAdminToken();
            const authHeaders = {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            };

            const redis = getRedis();
            const enrichTrip = async (trip: any) => {
              const cacheKey = `damoov:trip_enrichment:${trip.tripId}`;
              try {
                if (trip.scores && trip.statistics && trip.distanceKm > 0) {
                  return { ...trip, damoovStatistics: trip.statistics, damoovScores: trip.scores };
                }
                if (redis) {
                  const cached = await redis.get(cacheKey);
                  if (cached) {
                    const parsed = JSON.parse(cached);
                    return { ...trip, ...parsed };
                  }
                }
                const tripDetailRes = await axios.post(
                  `https://api.telematicssdk.com/trips/get/admin/v1/${trip.tripId}`,
                  {
                    Identifiers: { UserId: candidate },
                    IncludeDetails: true,
                    IncludeStatistics: true,
                    IncludeScores: true,
                  },
                  { headers: authHeaders },
                );
                const tripDetail = tripDetailRes.data?.Result?.Trip;
                if (!tripDetail) return trip;

                const stats = tripDetail?.Statistics ?? {};
                const scores = tripDetail?.Scores ?? {};
                const addresses = tripDetail?.Data?.Addresses ?? {};

                const enrichedData = {
                  distanceKm: Number(stats?.Mileage ?? trip.distanceKm ?? 0) || 0,
                  durationMin: Number(stats?.DurationMinutes ?? trip.durationMin ?? 0) || 0,
                  maxSpeed: stats?.MaxSpeed != null ? Number(stats.MaxSpeed) : trip.maxSpeed ?? null,
                  avgSpeed: stats?.AverageSpeed != null ? Number(stats.AverageSpeed) : trip.avgSpeed ?? null,
                  safetyScore: Math.round(Number(scores?.Safety ?? scores?.Overall ?? trip.safetyScore ?? 100)) || 100,
                  startLocation: addresses?.Start ?? trip.startLocation,
                  endLocation: addresses?.End ?? trip.endLocation,
                  damoovStatistics: stats,
                  damoovScores: scores,
                };

                db.drivingTrip.update({
                  where: { id: trip.id },
                  data: {
                    distanceKm: enrichedData.distanceKm,
                    durationMin: enrichedData.durationMin,
                    maxSpeed: enrichedData.maxSpeed,
                    avgSpeed: enrichedData.avgSpeed,
                    safetyScore: enrichedData.safetyScore,
                    startLocation: enrichedData.startLocation as any,
                    endLocation: enrichedData.endLocation as any,
                    scores: scores as any,
                    statistics: stats as any,
                  },
                }).catch(err => logger.error({ err, tripId: trip.id }, "Background trip persistence failed"));

                if (redis) {
                  await redis.setex(cacheKey, 24 * 3600, JSON.stringify(enrichedData)).catch(() => {});
                }
                return { ...trip, ...enrichedData };
              } catch (e: any) {
                logger.debug({ tripId: trip.tripId, err: e.message }, "Failed to enrich trip from Damoov");
                return trip;
              }
            };

            const batchSize = 5;
            for (let i = 0; i < trips.length; i += batchSize) {
              const batch = trips.slice(i, i + batchSize);
              const batchResults = await Promise.all(batch.map(enrichTrip));
              for (let j = 0; j < batchResults.length; j++) {
                trips[i + j] = batchResults[j];
              }
            }
          }
        }
      } catch (e: any) {
        logger.warn({ err: e.message }, "Trip enrichment skipped (best-effort)");
      }
    }

    return {
      data: trips,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get ordered GPS path points for a specific trip
   */
  async getTripPathById(tripId: string) {
    const trip = await db.drivingTrip.findUnique({
      where: { id: tripId },
      include: {
        events: { orderBy: { timestamp: "asc" } },
      },
    });

    if (!trip) throw new Error("Trip not found");

    return trip.events
      .filter((e: any) => e.latitude != null && e.longitude != null)
      .map((e: any) => ({
        lat: e.latitude,
        lon: e.longitude,
        timestamp: e.timestamp,
        speed: e.speed,
        severity: e.severity,
        eventType: e.eventType,
      }));
  },

  /**
   * End-trip summary with score + money tip + safety tip for Telematics Value Presentation
   */
  async getTripSummaryById(tripId: string): Promise<{
    trip: any;
    moneyTip: string;
    safetyTip: string;
  }> {
    const trip = await db.drivingTrip.findUnique({
      where: { id: tripId },
      include: { events: true },
    });

    if (!trip) throw new Error("Trip not found");

    const events = (trip as any).events || [];
    const harshBraking = events.filter((e: any) => /harsh|brak|brake/i.test(String(e.eventType))).length;
    const hardAccel = events.filter((e: any) => /accel|acceleration|hard.*accel/i.test(String(e.eventType))).length;
    const speeding = events.filter((e: any) => /speed|overspeed/i.test(String(e.eventType))).length;
    const totalEvents = harshBraking + hardAccel + speeding;

    let score = trip.safetyScore ?? 100;
    let distanceKm = trip.distanceKm ?? 0;
    let maxSpeed = trip.maxSpeed ?? null;
    let avgSpeed = trip.avgSpeed ?? null;
    let damoovStatistics = (trip as any).damoovStatistics ?? null;
    let damoovScores = (trip as any).damoovScores ?? null;
    let startLocation = trip.startLocation ?? null;
    let endLocation = trip.endLocation ?? null;

    try {
      const device = await db.telematicsDevice.findUnique({
        where: { vehicleId: trip.vehicleId },
      });

      if (device && trip.tripId) {
        const ADMIN_INSTANCE_ID_GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const deviceTokenLooksLikeGuid = !!device.deviceToken && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.deviceToken));
        const instanceIdLooksLikeGuid = !!device.instanceId && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.instanceId));
        const candidates = Array.from(new Set([
          deviceTokenLooksLikeGuid ? String(device.deviceToken) : null,
          instanceIdLooksLikeGuid ? String(device.instanceId) : null,
        ].filter(Boolean))) as string[];

        const candidate = candidates[0] || (device.deviceToken ? String(device.deviceToken) : null);
        if (candidate) {
          const accessToken = await getDamoovAdminToken();
          const authHeaders = {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          };

          const tripDetailRes = await axios.post(
            `https://api.telematicssdk.com/trips/get/admin/v1/${trip.tripId}`,
            {
              Identifiers: { UserId: candidate },
              IncludeDetails: true,
              IncludeStatistics: true,
              IncludeScores: true,
            },
            { headers: authHeaders },
          );

          const tripDetail = tripDetailRes.data?.Result?.Trip;
          if (tripDetail) {
            const stats = tripDetail?.Statistics ?? {};
            const scores = tripDetail?.Scores ?? {};
            const addresses = tripDetail?.Data?.Addresses ?? {};

            distanceKm = Number(stats?.Mileage ?? distanceKm) || 0;
            maxSpeed = stats?.MaxSpeed != null ? Number(stats.MaxSpeed) : maxSpeed;
            avgSpeed = stats?.AverageSpeed != null ? Number(stats.AverageSpeed) : avgSpeed;
            score = Math.round(Number(scores?.Safety ?? scores?.Overall ?? score)) || score;

            damoovStatistics = stats;
            damoovScores = scores;
            startLocation = addresses?.Start ?? startLocation;
            endLocation = addresses?.End ?? endLocation;
          }
        }
      }
    } catch (e: any) {
      logger.warn({ err: e.message, tripId: trip.tripId }, "Failed to enrich trip summary from Damoov");
    }

    let moneyTip: string;
    if (totalEvents === 0 && score >= 80) {
      moneyTip = "Smooth driving helps tyres and brakes last longer — you're on track.";
    } else if (totalEvents > 0) {
      moneyTip = `${totalEvents} events (harsh brake/accel/speed) add wear. Smoother driving could save on wear.`;
    } else {
      moneyTip = "Gentle braking and steady speed reduce fuel use and wear.";
    }

    let safetyTip: string;
    if (score >= 85) {
      safetyTip = "Great safety score. Maintain smooth braking and steady speed.";
    } else if (harshBraking > 0 || hardAccel > 0) {
      safetyTip = "Fewer harsh events = safer trips and less wear.";
    } else {
      safetyTip = "Small improvements in smoothness can raise your score and reduce wear.";
    }

    return {
      trip: {
        id: trip.id,
        startTime: trip.startTime,
        endTime: trip.endTime,
        distanceKm,
        durationMin: trip.durationMin ?? 0,
        safetyScore: score,
        maxSpeed,
        avgSpeed,
        damoovStatistics,
        damoovScores,
        startLocation,
        endLocation,
      },
      moneyTip,
      safetyTip,
    };
  },

  /**
   * Pull trips for all active devices from Damoov API (Admin Method).
   */
  async syncTripsForAllDevices(options?: { forceLogin?: boolean }) {
    logger.info("Starting Damoov API sync for all devices (Admin Method)");

    const redis = getRedis();
    const accessToken = await getDamoovAdminToken(options?.forceLogin);
    if (!accessToken) return;

    const devices = await db.telematicsDevice.findMany({
      where: { isActive: true },
      include: { vehicle: true },
    });

    if (!devices.length) return;

    for (const device of devices) {
      try {
        if (!device.deviceToken) continue;

        const ADMIN_INSTANCE_ID_GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const deviceTokenLooksLikeGuid = !!device.deviceToken && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.deviceToken));
        const instanceIdLooksLikeGuid = !!device.instanceId && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.instanceId));

        if (!deviceTokenLooksLikeGuid && !instanceIdLooksLikeGuid) continue;

        const startDate = device.lastSyncAt
          ? new Date(device.lastSyncAt.getTime() - 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const requestBody = {
          IncludeDetails: true,
          IncludeStatistics: true,
          IncludeScores: true,
          IncludeRelated: true,
          Locale: "EN",
          UnitSystem: "Si",
          StartDateTimestampSec: Math.floor(startDate.getTime() / 1000),
          EndDateTimestampSec: Math.floor(endDate.getTime() / 1000),
          SortBy: "StartDateUtc_Desc",
          Paging: { Page: 1, Count: 100, IncludePagingInfo: true },
        };

        const candidates = Array.from(new Set([
          deviceTokenLooksLikeGuid ? String(device.deviceToken) : null,
          instanceIdLooksLikeGuid ? String(device.instanceId) : null,
        ].filter(Boolean))) as string[];

        let createdTrips = 0;
        for (const candidate of candidates) {
          try {
            const identifiers = { UserId: candidate };
            const response = await axios.post(
              "https://api.telematicssdk.com/trips/get/admin/v1",
              { Identifiers: identifiers, ...requestBody },
              {
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

            const tripsResult = response.data?.Result?.Trips;
            let fetchedTrips: any[] = [];
            if (Array.isArray(tripsResult)) fetchedTrips = tripsResult;
            else if (tripsResult?.Items && Array.isArray(tripsResult.Items)) fetchedTrips = tripsResult.Items;
            else if (tripsResult?.Data && Array.isArray(tripsResult.Data)) fetchedTrips = tripsResult.Data;
            else {
              const alt = response.data?.Trips ?? response.data?.Items ?? response.data?.Result?.Items ?? null;
              if (Array.isArray(alt)) fetchedTrips = alt;
            }

            const authHeaders = {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            };

            for (const trip of fetchedTrips) {
              try {
                const tripId = String(trip.TripID ?? trip.Id ?? "");
                if (!tripId) continue;

                const existingTrip = await db.drivingTrip.findUnique({ where: { tripId } });
                const existingEventsCount = existingTrip ? await db.drivingEvent.count({ where: { tripId: existingTrip.id } }) : 0;
                const looksLikePlaceholder = existingTrip?.safetyScore === 100 && (existingTrip.distanceKm === 0 || existingTrip.durationMin === 0);

                if (existingTrip && !looksLikePlaceholder && existingEventsCount > 0) continue;

                const [detailRes, waypointsRes] = await Promise.all([
                  axios.post(
                    `https://api.telematicssdk.com/trips/get/admin/v1/${tripId}`,
                    { Identifiers: { UserId: candidate }, IncludeDetails: true, IncludeEvents: true, IncludeScores: true, IncludeStatistics: true },
                    { headers: authHeaders }
                  ),
                  axios.post(
                    `https://api.telematicssdk.com/trips/get/admin/v1/${tripId}/waypoints`,
                    { Identifiers: { UserId: candidate }, IncludeWaypoints: true },
                    { headers: authHeaders }
                  ),
                ]);

                const tripDetail = detailRes.data?.Result?.Trip;
                const waypoints = waypointsRes.data?.Result?.Trip?.Waypoints ?? [];
                if (!tripDetail) continue;

                const startDateIso = tripDetail?.Data?.StartDate;
                const endDateIso = tripDetail?.Data?.EndDate;
                const startDateT = startDateIso ? new Date(startDateIso) : new Date();
                const endDateT = endDateIso ? new Date(endDateIso) : new Date();

                const stats = tripDetail?.Statistics ?? {};
                const scores = tripDetail?.Scores ?? {};
                const addresses = tripDetail?.Data?.Addresses ?? {};

                const distanceKm = Number(stats?.Mileage ?? 0) || 0;
                const durationMin = Number(stats?.DurationMinutes ?? 0) || 0;
                const safetyScore = Math.round(Number(scores?.Safety ?? scores?.Overall ?? 100)) || 100;

                const eventRows = (Array.isArray(tripDetail?.Events) ? tripDetail.Events : [])
                  .map((e: any) => ({
                    eventType: String(e?.Type ?? ""),
                    timestamp: e?.Date ? new Date(e.Date) : null,
                    latitude: e?.Lat,
                    longitude: e?.Long,
                    severity: e?.Value != null ? Number(e.Value) : null,
                    speed: e?.Speed != null ? Number(e.Speed) : null,
                  }))
                  .filter((r: any) => r.timestamp instanceof Date && !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude));

                const waypointRows = (Array.isArray(waypoints) ? waypoints : [])
                  .map((w: any) => ({
                    eventType: "",
                    timestamp: w?.PointDateUnixMilliseconds != null ? new Date(Number(w.PointDateUnixMilliseconds)) : null,
                    latitude: w?.Lat,
                    longitude: w?.Long,
                    speed: w?.Speed != null ? Number(w.Speed) : null,
                  }))
                  .filter((r: any) => r.timestamp instanceof Date && !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude));

                if (!existingTrip) {
                  await db.drivingTrip.create({
                    data: {
                      vehicleId: device.vehicleId, tripId, startTime: startDateT, endTime: endDateT,
                      distanceKm, durationMin, safetyScore, status: "COMPLETED",
                      startLocation: addresses?.Start ?? null, endLocation: addresses?.End ?? null,
                      events: { create: [...eventRows, ...waypointRows] },
                    },
                  });
                  createdTrips++;
                } else {
                  await db.drivingTrip.update({
                    where: { tripId },
                    data: {
                      startTime: startDateT, endTime: endDateT, distanceKm, durationMin, safetyScore,
                      startLocation: addresses?.Start ?? null, endLocation: addresses?.End ?? null,
                    },
                  });
                  await db.drivingEvent.deleteMany({ where: { tripId: existingTrip.id } });
                  await db.drivingEvent.createMany({
                    data: [...eventRows, ...waypointRows].map((r: any) => ({ ...r, tripId: existingTrip.id })),
                  });
                }
              } catch (tripErr: any) {
                logger.warn({ tripErr: tripErr.message, tripId: trip?.TripID }, "Failed one trip sync");
              }
            }
          } catch (candidateErr: any) {
            if (candidateErr.response?.status === 401 && redis) await redis.del(ADMIN_TOKEN_REDIS_KEY);
            logger.warn({ error: candidateErr.message, deviceId: device.id }, "Candidate sync failed");
          }
        }
        await db.telematicsDevice.update({
          where: { id: device.id },
          data: { lastSyncAt: endDate },
        });
      } catch (error: any) {
        logger.error({ deviceId: device.id, error: error.message }, "Failed sync for device");
      }
    }
  },
};
