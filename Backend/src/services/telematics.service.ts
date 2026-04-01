import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { env } from "../config/env";
import axios from "axios";

const db = dbInstances;

const DAMOOV_API_BASE = "https://user.telematicssdk.com/v1";

import { getRedis, runRedisCommand } from "../config/redis";

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
    const cachedToken = await runRedisCommand((client) =>
      client.get(ADMIN_TOKEN_REDIS_KEY),
    );
    if (cachedToken) return cachedToken;

    if (!forceLogin) {
      const backoffUntil = await runRedisCommand((client) =>
        client.get(RATE_LIMIT_BACKOFF_REDIS_KEY),
      );
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
      await runRedisCommand((client) =>
        client.setex(ADMIN_TOKEN_REDIS_KEY, 3000, token),
      );
    }
    return token;
  } catch (err: any) {
    if (isRateLimitError(err)) {
      if (redis) {
        const backoffTime = Date.now() + RATE_LIMIT_BACKOFF_MS;
        await runRedisCommand((client) =>
          client.setex(RATE_LIMIT_BACKOFF_REDIS_KEY, 7200, backoffTime.toString()),
        );
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
   * Schema: one row per vehicleId (unique), one row per instanceId (unique).
   * So we update the existing row for this vehicle with new instanceId, or move the row
   * that has this instanceId to this vehicle, or create if neither exists.
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
      // If the row matches instanceId, update it (possibly changing its vehicleId)
      // If the row matches vehicleId, update it (possibly changing its instanceId)
      return db.telematicsDevice.update({
        where: { id: existing.id },
        data: { instanceId, vehicleId, ...payload },
      });
    }

    // 3) No row for this vehicle or this instanceId → create
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

    // Damoov payload structure (simplified/assumed based on standard telematics SDKs)
    // payload: {
    //   TripID, InstanceID, StartDate, EndDate,
    //   Distance, Duration,
    //   Score_Overall, Score_Speeding,
    //   Events: [...]
    // }

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

    // Find the vehicle via InstanceID
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

    // Save the Trip
    const trip = await db.drivingTrip.create({
      data: {
        vehicleId,
        tripId: TripID || `MANUAL_${Date.now()}`, // Fallback if no TripID
        startTime: new Date(StartDate * 1000), // Assumes unix timestamp
        endTime: new Date(EndDate * 1000),
        distanceKm: Distance || 0,
        durationMin: (Duration || 0) / 60,
        safetyScore: Score_Overall || 100,
        status: "COMPLETED",
        events: {
          create: (Events || []).map((e: any) => ({
            eventType: e.Type, // HARSH_BRAKING, etc.
            timestamp: new Date((e.Date || StartDate) * 1000),
            latitude: e.Latitude,
            longitude: e.Longitude,
            severity: e.Value,
            speed: e.Speed,
          })),
        },
      },
    });

    // Update Vehicle Health Score (Simple Moving Average of last 20 trips)
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

    const [trips, total] = await Promise.all([
      db.drivingTrip.findMany({
        where: { vehicleId },
        orderBy: { startTime: "desc" },
        take: limit,
        skip,
        include: { events: true },
      }),
      db.drivingTrip.count({ where: { vehicleId } }),
    ]);

    // Debugging aid: quickly see if trips exist but UI day-filter is excluding them.
    // (We avoid logging events to keep logs lightweight.)
    if (typeof total === "number") {
      const latest = Array.isArray(trips) && trips.length ? trips[0].startTime : null;
      logger.info(
        { vehicleId, totalTrips: total, latestStartTime: latest ? new Date(latest).toISOString() : null },
        "telematics.getTrips result"
      );
    }

    // Enrich with Damoov trip detail so the app can display full breakdown
    // (Mileage, Eco scores, PhoneUsage, Region/Cities, etc.) without relying on DB migrations.
    // This is best-effort: if Damoov calls fail, we still return stored trip data.
    if (trips.length) {
      try {
        const device = await db.telematicsDevice.findUnique({
          where: { vehicleId },
        });

        if (device) {
          const ADMIN_INSTANCE_ID_GUID_REGEX =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          const deviceTokenLooksLikeGuid =
            !!device.deviceToken && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.deviceToken));
          const instanceIdLooksLikeGuid =
            !!device.instanceId && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.instanceId));

          const candidates = Array.from(
            new Set(
              [
                deviceTokenLooksLikeGuid ? String(device.deviceToken) : null,
                instanceIdLooksLikeGuid ? String(device.instanceId) : null,
              ].filter(Boolean),
            ),
          ) as string[];

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
                // 1. Check if we already have it in DB
                if (trip.scores && trip.statistics && trip.distanceKm > 0) {
                  return {
                    ...trip,
                    damoovStatistics: trip.statistics,
                    damoovScores: trip.scores
                  };
                }

                // 2. Check if we have it in Redis (pending persistence/recent)
                if (redis) {
                  const cached = await runRedisCommand((client) =>
                    client.get(cacheKey),
                  );
                  if (cached) {
                    const parsed = JSON.parse(cached);
                    return { ...trip, ...parsed };
                  }
                }

                // 3. Fetch from Damoov
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

                const distanceKm = Number(stats?.Mileage ?? trip.distanceKm ?? 0) || 0;
                const durationMin = Number(stats?.DurationMinutes ?? trip.durationMin ?? 0) || 0;
                const maxSpeed = stats?.MaxSpeed != null ? Number(stats.MaxSpeed) : trip.maxSpeed ?? null;
                const avgSpeed = stats?.AverageSpeed != null ? Number(stats.AverageSpeed) : trip.avgSpeed ?? null;
                const safetyScore = Math.round(Number(scores?.Safety ?? scores?.Overall ?? trip.safetyScore ?? 100)) || 100;
                const startLocation = addresses?.Start ?? trip.startLocation;
                const endLocation = addresses?.End ?? trip.endLocation;

                const enrichedData = {
                  distanceKm,
                  durationMin,
                  maxSpeed,
                  avgSpeed,
                  safetyScore,
                  startLocation,
                  endLocation,
                  damoovStatistics: stats,
                  damoovScores: scores,
                };

                // 4. PERSIST to DB (async to avoid blocking)
                db.drivingTrip.update({
                  where: { id: trip.id },
                  data: {
                    distanceKm,
                    durationMin,
                    maxSpeed,
                    avgSpeed,
                    safetyScore,
                    startLocation: startLocation as any,
                    endLocation: endLocation as any,
                    scores: scores as any,
                    statistics: stats as any,
                  },
                }).catch(err => logger.error({ err, tripId: trip.id }, "Background trip persistence failed"));

                // 5. CACHE in Redis (TTL 1 day for recent trips)
                if (redis) {
                  await runRedisCommand((client) =>
                    client.setex(cacheKey, 24 * 3600, JSON.stringify(enrichedData)),
                  );
                }

                return { ...trip, ...enrichedData };
              } catch (e: any) {
                logger.debug(
                  { tripDbId: trip.id, tripId: trip.tripId, err: e?.response?.data || e?.message },
                  "Failed to enrich trip from Damoov"
                );
                return trip;
              }
            };

            // Parallel enrichment with a slightly larger batch size to optimize throughput
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
        logger.warn({ err: e?.message }, "Trip enrichment skipped (best-effort)");
      }
    }

    return {
      data: trips,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get ordered GPS path points for a specific trip
   */
  async getTripPathById(tripId: string) {
    const trip = await db.drivingTrip.findUnique({
      where: { id: tripId },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!trip) {
      throw new Error("Trip not found");
    }

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
   * A5: End-trip summary with score + money tip + safety tip for Telematics Value Presentation
   */
  async getTripSummaryById(tripId: string): Promise<{
    trip: {
      id: string;
      startTime: Date;
      endTime: Date;
      distanceKm: number;
      durationMin: number;
      safetyScore: number;
      maxSpeed: number | null;
      avgSpeed: number | null;
      damoovStatistics: any;
      damoovScores: any;
      startLocation: any;
      endLocation: any;
    };
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

    // Best-effort enrichment for full breakdown (Eco scores, Speeding, PhoneUsage, etc.)
    try {
      const device = await db.telematicsDevice.findUnique({
        where: { vehicleId: trip.vehicleId },
      });

      if (device && trip.tripId) {
        const ADMIN_INSTANCE_ID_GUID_REGEX =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const deviceTokenLooksLikeGuid =
          !!device.deviceToken && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.deviceToken));
        const instanceIdLooksLikeGuid =
          !!device.instanceId && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.instanceId));

        const candidates = Array.from(
          new Set(
            [
              deviceTokenLooksLikeGuid ? String(device.deviceToken) : null,
              instanceIdLooksLikeGuid ? String(device.instanceId) : null,
            ].filter(Boolean),
          ),
        ) as string[];

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
            score =
              Math.round(Number(scores?.Safety ?? scores?.Overall ?? score)) || score;

            damoovStatistics = stats;
            damoovScores = scores;
            startLocation = addresses?.Start ?? startLocation;
            endLocation = addresses?.End ?? endLocation;
          }
        }
      }
    } catch (e: any) {
      logger.warn(
        { err: e?.response?.data || e?.message, tripDbId: trip.id, tripId: trip.tripId },
        "Failed to enrich trip summary from Damoov; falling back to stored values"
      );
    }

    let moneyTip: string;
    if (totalEvents === 0 && score >= 80) {
      moneyTip = "Smooth driving helps tyres and brakes last longer — you're on track.";
    } else if (totalEvents > 0) {
      const roughSavings = totalEvents * 50; // rough ₹ per trip impact
      moneyTip = `${totalEvents} event${totalEvents > 1 ? "s" : ""} (harsh brake/accel/speed) add wear. Smoother driving could save ~₹${roughSavings}+ on wear per month.`;
    } else {
      moneyTip = "Gentle braking and steady speed reduce fuel use and wear — keep it up.";
    }

    let safetyTip: string;
    if (score >= 85) {
      safetyTip = "Great safety score. Maintain smooth braking and steady speed.";
    } else if (harshBraking > 0 || hardAccel > 0) {
      const parts: string[] = [];
      if (harshBraking > 0) parts.push(`${harshBraking} harsh brake${harshBraking > 1 ? "s" : ""}`);
      if (hardAccel > 0) parts.push(`${hardAccel} hard acceleration${hardAccel > 1 ? "s" : ""}`);
      safetyTip = `Fewer ${parts.join(" and ")} = safer trips and less wear.`;
    } else if (speeding > 0) {
      safetyTip = "Staying within speed limits improves safety and fuel efficiency.";
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
   * Pull trips for all active devices from Damoov API (Cron job Alternative).
   * Uses cached admin token to avoid login rate limits; on 429 skips this run and retries next schedule.
   * @param options.forceLogin - If true, attempt login even during rate-limit backoff (for manual/immediate sync).
   */
  async syncTripsForAllDevices(options?: { forceLogin?: boolean }) {
    logger.info("Starting Damoov API sync for all devices (Admin Method)");

    const redis = getRedis();
    const accessToken = await getDamoovAdminToken(options?.forceLogin);
    if (!accessToken) {
      return;
    }

    const devices = await db.telematicsDevice.findMany({
      where: { isActive: true },
      include: { vehicle: true },
    });

    if (!devices.length) return;

    for (const device of devices) {
      try {
        // Admin trips API needs a GUID-like identifier. In this integration,
        // that GUID is stored as `TelematicsDevice.deviceToken`.
        if (!device.deviceToken) {
          logger.warn(
            { deviceId: device.id, vehicleId: device.vehicleId, instanceId: device.instanceId },
            "Skipping Damoov admin trip sync: deviceToken missing"
          );
          continue;
        }

        const ADMIN_INSTANCE_ID_GUID_REGEX =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const deviceTokenLooksLikeGuid =
          !!device.deviceToken && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.deviceToken));
        const instanceIdLooksLikeGuid =
          !!device.instanceId && ADMIN_INSTANCE_ID_GUID_REGEX.test(String(device.instanceId));

        // Some deployments store a placeholder `instanceId` (e.g. "app-...") and a GUID-like `deviceToken`.
        // Use whichever value looks like a GUID for the admin API.
        if (!deviceTokenLooksLikeGuid && !instanceIdLooksLikeGuid) {
          logger.warn(
            {
              deviceId: device.id,
              vehicleId: device.vehicleId,
              instanceId: device.instanceId,
              deviceToken: device.deviceToken,
              deviceTokenLooksLikeGuid,
              instanceIdLooksLikeGuid,
            },
            "Skipping Damoov admin trip sync: no GUID-like identifier found"
          );
          continue;
        }

        // Query a wider window so we don't miss trips due to clock skew
        // or small "lastSyncAt" gaps (and to cover when the test trip was created).
        const startDate = device.lastSyncAt
          ? new Date(device.lastSyncAt.getTime() - 30 * 24 * 60 * 60 * 1000) // - 30d
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default - 30d
        const endDate = new Date();

        // Damoov expects a payload shaped like the official python SDK:
        // - Identifiers at top-level
        // - include flags + date range at top-level
        // (no `{ request: ... }` wrapper).
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

        // Damoov trips list fetch expects `Identifiers.UserId` (user/device identifier).
        // Depending on how the integration is set up, the "user id" may map to either
        // our stored `deviceToken` or `instanceId`. Try both.
        const candidates = Array.from(
          new Set(
            [
              deviceTokenLooksLikeGuid ? String(device.deviceToken) : null,
              instanceIdLooksLikeGuid ? String(device.instanceId) : null,
            ].filter(Boolean),
          ),
        ) as string[];

        let createdTrips = 0;
        for (const candidate of candidates) {
          const identifiers = {
            // Required identifier for trip list in Damoov Telematics API.
            // (Telematics Python SDK calls this `user_id`.)
            UserId: candidate,
          };
          const candidateShort = `${candidate.slice(0, 8)}...${candidate.slice(-6)}`;

          logger.info(
            {
              vehicleId: device.vehicleId,
              instanceId: device.instanceId,
              deviceToken: device.deviceToken ? String(device.deviceToken) : null,
              adminSyncCandidateShort: candidateShort,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            },
            "Damoov admin trip sync request (candidate)"
          );

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

          if (response.status === 401) {
            if (redis) await redis.del(ADMIN_TOKEN_REDIS_KEY);
            logger.warn("Damoov admin token expired; will re-login on next sync");
            return;
          }

          // Different Damoov responses may nest trips differently.
          // First, log the response shape (preview only) so we can fix parsing accurately.
          const resultTop = response.data?.Result;
          const tripsResult = response.data?.Result?.Trips;
          const responsePreview =
            JSON.stringify(response.data, (_k, v) => {
              if (typeof v === "string" && /(token|secret|password|authorization)/i.test(_k)) return "[REDACTED]";
              return v;
            }).slice(0, 1200);

          logger.info(
            {
              vehicleId: device.vehicleId,
              adminSyncCandidateShort: candidateShort,
              responseStatus: response.status,
              responseTopKeys: response.data && typeof response.data === "object" ? Object.keys(response.data) : null,
              resultTopKeys: resultTop && typeof resultTop === "object" ? Object.keys(resultTop) : null,
              tripsResultType: tripsResult == null ? null : typeof tripsResult,
              tripsResultKeys:
                tripsResult && typeof tripsResult === "object" && !Array.isArray(tripsResult)
                  ? Object.keys(tripsResult)
                  : null,
              responsePreview,
            },
            "Damoov admin sync response preview (candidate)"
          );

          let fetchedTrips: any[] = [];
          // Primary: Result.Trips (array or object-with-array)
          if (Array.isArray(tripsResult)) {
            fetchedTrips = tripsResult;
          } else if (tripsResult?.Items && Array.isArray(tripsResult.Items)) {
            fetchedTrips = tripsResult.Items;
          } else if (tripsResult?.Data && Array.isArray(tripsResult.Data)) {
            fetchedTrips = tripsResult.Data;
          } else if (tripsResult?.Trips && Array.isArray(tripsResult.Trips)) {
            fetchedTrips = tripsResult.Trips;
          } else if (tripsResult?.Trip && Array.isArray(tripsResult.Trip)) {
            fetchedTrips = tripsResult.Trip;
          } else {
            // Fallbacks
            const alt =
              response.data?.Trips ??
              response.data?.Items ??
              response.data?.Result?.Items ??
              response.data?.Result?.Data ??
              null;

            if (Array.isArray(alt)) fetchedTrips = alt;
            else if (alt?.Items && Array.isArray(alt.Items)) fetchedTrips = alt.Items;
            else if (alt?.Data && Array.isArray(alt.Data)) fetchedTrips = alt.Data;
            else if (alt?.Trips && Array.isArray(alt.Trips)) fetchedTrips = alt.Trips;
          }

          logger.info(
            {
              vehicleId: device.vehicleId,
              adminSyncCandidateShort: candidateShort,
              fetchedTripsCount: fetchedTrips.length,
            },
            "Fetched trips from Damoov (admin sync, candidate)"
          );

              const authHeaders = {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              };

          if (fetchedTrips.length > 0) {
            const first = fetchedTrips[0];
            logger.info(
              {
                adminSyncCandidateShort: candidateShort,
                firstTripId: first?.TripID ?? first?.Id ?? null,
                firstTripKeys: first && typeof first === "object" ? Object.keys(first) : null,
                hasData: !!first?.Data,
                dataKeys: first?.Data && typeof first.Data === "object" ? Object.keys(first.Data) : null,
                hasStart: first?.StartDate != null || first?.StartDateUtc != null || first?.Data?.StartDate != null,
                hasEnd: first?.EndDate != null || first?.EndDateUtc != null || first?.Data?.EndDate != null,
                hasDistance: first?.Distance != null || first?.Statistics?.Distance != null || first?.Data?.Distance != null,
                hasDuration:
                  first?.Duration != null ||
                  first?.Statistics?.Duration != null ||
                  (first?.Statistics?.DurationMinutes != null) ||
                  first?.Data?.Duration != null,
                hasScore:
                  first?.Score_Overall != null ||
                  first?.Scores?.Overall != null ||
                  first?.Scores?.Safety != null,
                hasRelated: Array.isArray(first?.Related) || (first?.Related && typeof first.Related === "object"),
                relatedPreview:
                  Array.isArray(first?.Related) ? first.Related.slice(0, 3).map((r: any) => ({ Type: r?.Type, Uri: r?.Uri })) : null,
              },
              "Damoov trip list first item shape (debug)"
            );
          }

          for (const trip of fetchedTrips) {
            const tripId = String(trip.TripID ?? trip.Id ?? "");
            if (!tripId) continue;
                const existingTrip = await db.drivingTrip.findUnique({
              where: { tripId },
            });
                const existingEventsCount = existingTrip
                  ? await db.drivingEvent.count({
                      where: { tripId: existingTrip.id },
                    })
                  : 0;

                const looksLikePlaceholder =
                  existingTrip?.safetyScore === 100 &&
                  (existingTrip.distanceKm === 0 || existingTrip.durationMin === 0);

                // If trip is missing in DB OR events/waypoints are missing in DB,
                // fetch full trip details + waypoints and persist.
                const needsFullDetails =
                  !existingTrip || looksLikePlaceholder || existingEventsCount === 0;

                if (!needsFullDetails) continue;

                // Fetch complete trip detail (includes Events + Data + Statistics + Scores)
                // and fetch track waypoints (so TripDetail map path renders).
                const [detailRes, waypointsRes] = await Promise.all([
                  axios.post(
                    `https://api.telematicssdk.com/trips/get/admin/v1/${tripId}`,
                    {
                      Identifiers: { UserId: candidate },
                      IncludeDetails: true,
                      IncludeEvents: true,
                      IncludeScores: true,
                      IncludeStatistics: true,
                    },
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

                if (!tripDetail) {
                  logger.warn(
                    { tripId, candidateShort },
                    "Skipping trip: no trip detail returned"
                  );
                  continue;
                }

                const startDateIso = tripDetail?.Data?.StartDate;
                const endDateIso = tripDetail?.Data?.EndDate;

                const startDate = startDateIso ? new Date(startDateIso) : new Date();
                const endDate = endDateIso ? new Date(endDateIso) : new Date();

                const stats = tripDetail?.Statistics ?? {};
                const scores = tripDetail?.Scores ?? {};

                const distanceKm: number = Number(stats?.Mileage ?? 0) || 0;
                const durationMin: number = Number(stats?.DurationMinutes ?? 0) || 0;

                const maxSpeed: number | null = stats?.MaxSpeed != null ? Number(stats.MaxSpeed) : null;
                const avgSpeed: number | null = stats?.AverageSpeed != null ? Number(stats.AverageSpeed) : null;

                const safetyScore: number =
                  Math.round(Number(scores?.Safety ?? scores?.Overall ?? 100)) || 100;

                const startLocation = tripDetail?.Data?.Addresses?.Start ?? null;
                const endLocation = tripDetail?.Data?.Addresses?.End ?? null;

                const eventsFromTrip = Array.isArray(tripDetail?.Events)
                  ? tripDetail.Events
                  : [];

                // Map Damoov events to DrivingEvent.
                const eventRows = eventsFromTrip
                  .map((e: any) => ({
                    eventType: String(e?.Type ?? ""), // e.g. "Acceleration", "Braking"
                    timestamp: e?.Date ? new Date(e.Date) : null,
                    latitude: e?.Lat,
                    longitude: e?.Long,
                    severity: e?.Value != null ? Number(e.Value) : null,
                    speed: e?.Speed != null ? Number(e.Speed) : null,
                  }))
                  .filter(
                    (r: any) =>
                      r.timestamp instanceof Date &&
                      !Number.isNaN(r.latitude) &&
                      !Number.isNaN(r.longitude)
                  );

                // Map waypoints (track points) to DrivingEvent with eventType="" so UI uses path markers.
                const waypointRows = Array.isArray(waypoints)
                  ? waypoints
                      .map((w: any) => ({
                        eventType: "",
                        timestamp:
                          w?.PointDateUnixMilliseconds != null
                            ? new Date(Number(w.PointDateUnixMilliseconds))
                            : null,
                        latitude: w?.Lat,
                        longitude: w?.Long,
                        severity: null,
                        speed: w?.Speed != null ? Number(w.Speed) : null,
                      }))
                      .filter(
                        (r: any) =>
                          r.timestamp instanceof Date &&
                          !Number.isNaN(r.latitude) &&
                          !Number.isNaN(r.longitude)
                      )
                  : [];

                // Persist trip + replace events for idempotency.
                if (!existingTrip) {
                  await db.drivingTrip.create({
                    data: {
                      vehicleId: device.vehicleId,
                      tripId,
                      startTime: startDate,
                      endTime: endDate,
                      distanceKm,
                      durationMin,
                      maxSpeed,
                      avgSpeed,
                      safetyScore,
                      status: "COMPLETED",
                      startLocation,
                      endLocation,
                      events: {
                        create: [...eventRows, ...waypointRows],
                      },
                    },
                  });
                } else {
                  await db.drivingTrip.update({
                    where: { tripId },
                    data: {
                      startTime: startDate,
                      endTime: endDate,
                      distanceKm,
                      durationMin,
                      maxSpeed,
                      avgSpeed,
                      safetyScore,
                      status: "COMPLETED",
                      startLocation,
                      endLocation,
                    },
                  });

                  // Clear and re-insert track points + events.
                  await db.drivingEvent.deleteMany({
                    where: { tripId: existingTrip.id },
                  });
                  await db.drivingEvent.createMany({
                    data: [...eventRows, ...waypointRows].map((r: any) => ({
                      ...r,
                      tripId: existingTrip.id,
                    })),
                  });
                }

                createdTrips += 1;
          }
        }

        logger.info(
          { vehicleId: device.vehicleId, instanceId: device.instanceId, createdTrips },
          "Damoov admin sync persisted trips"
        );

        await db.telematicsDevice.update({
          where: { id: device.id },
          data: { lastSyncAt: endDate },
        });
      } catch (error: any) {
        if (error.response?.status === 401) {
          if (redis) await redis.del(ADMIN_TOKEN_REDIS_KEY);
          logger.warn("Damoov admin token rejected; will re-login on next sync");
          return;
        }
        if (isRateLimitError(error)) {
          logger.warn(
            "Damoov Admin API rate limited during trip fetch; skipping this sync, will retry on next schedule"
          );
          return;
        }
        if (error.response?.status === 403) {
          logger.warn(
            { deviceId: device.id, instanceId: device.instanceId },
            "Damoov returned 403 Forbidden (access denied or inactive user)"
          );
        } else if (error.response?.status === 404) {
          logger.warn(
            { deviceId: device.id, instanceId: device.instanceId },
            "Device not found in Damoov Datahub (user hasn't driven yet)"
          );
        } else {
          logger.error(
            { deviceId: device.id, error: error.response?.data || error.message },
            "Failed to sync trips for device"
          );
        }
      }
    }
  },
};
