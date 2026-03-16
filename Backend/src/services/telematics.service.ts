import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { env } from "../config/env";
import axios from "axios";

const db = dbInstances as any;

const DAMOOV_API_BASE = "https://user.telematicssdk.com/v1";

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

    // 1) If this instanceId is already linked (possibly to another vehicle), move it to this vehicle
    const byInstance = await db.telematicsDevice.findUnique({ where: { instanceId } });
    if (byInstance) {
      return db.telematicsDevice.update({
        where: { instanceId },
        data: { vehicleId, ...payload },
      });
    }

    // 2) If this vehicle already has a device, update it to this instanceId/token
    const byVehicle = await db.telematicsDevice.findUnique({ where: { vehicleId } });
    if (byVehicle) {
      return db.telematicsDevice.update({
        where: { vehicleId },
        data: { instanceId, ...payload },
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
    trip: { id: string; startTime: Date; endTime: Date; distanceKm: number; durationMin: number; safetyScore: number };
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

    const score = trip.safetyScore ?? 100;
    const distanceKm = trip.distanceKm ?? 0;

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
      },
      moneyTip,
      safetyTip,
    };
  },

  /**
   * Pull trips for all active devices from Damoov API (Cron job Alternative)
   */
  async syncTripsForAllDevices() {
    logger.info("Starting Damoov API sync for all devices (Admin Method)");

    if (!env.DAMOOV_ADMIN_EMAIL || !env.DAMOOV_ADMIN_PASSWORD) {
      logger.error("Missing DAMOOV_ADMIN_EMAIL or DAMOOV_ADMIN_PASSWORD for sync");
      return;
    }

    const devices = await db.telematicsDevice.findMany({
      where: { isActive: true },
      include: { vehicle: true },
    });

    if (!devices.length) return;

    let accessToken = "";
    try {
      // 1. Authenticate as Admin
      const authRes = await axios.post("https://user.telematicssdk.com/v1/Auth/Login", {
        LoginFields: JSON.stringify({ email: env.DAMOOV_ADMIN_EMAIL }),
        Password: env.DAMOOV_ADMIN_PASSWORD
      }, {
        headers: { "accept": "application/json", "content-type": "application/json" }
      });
      accessToken = authRes.data?.Result?.AccessToken?.Token;
      if (!accessToken) throw new Error("No AccessToken in response");
    } catch (err: any) {
      logger.error({ error: err.response?.data || err.message }, "Failed to login to Damoov Admin API");
      return;
    }

    // 2. Poll for each device
    for (const device of devices) {
      try {
        const startDate = device.lastSyncAt
          ? new Date(device.lastSyncAt.getTime() - 5 * 60000)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endDate = new Date();

        // API requires at least one of InstanceIds, ApplicationIds, CompanyIds, or UserId. We filter by instance.
        const requestBody = {
          Identifiers: {
            InstanceIds: [device.instanceId],
          },
          IncludeDetails: true,
          IncludeStatistics: true,
          IncludeScores: true,
          IncludeEvents: true,
          StartDateTimestampSec: Math.floor(startDate.getTime() / 1000),
          EndDateTimestampSec: Math.floor(endDate.getTime() / 1000),
        };

        const response = await axios.post(
          `https://api.telematicssdk.com/trips/get/admin/v1`,
          requestBody,
          {
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        // API sometimes returns trips inside Result.Trips
        const fetchedTrips = response.data?.Result?.Trips || response.data?.Trips || [];

        for (const trip of fetchedTrips) {
          const tripId = trip.TripID || trip.Id;
          const existingTrip = await db.drivingTrip.findUnique({
            where: { tripId }
          });

          if (!existingTrip) {
            await this.processWebhook({
              InstanceID: device.instanceId,
              TripID: tripId,
              StartDate: trip.StartDate || Math.floor(new Date(trip.StartDateUtc || Date.now()).getTime() / 1000),
              EndDate: trip.EndDate || Math.floor(new Date(trip.EndDateUtc || Date.now()).getTime() / 1000),
              Distance: trip.Distance || trip.Statistics?.Distance || 0,
              Duration: trip.Duration || trip.Statistics?.Duration || 0,
              Score_Overall: trip.Score_Overall || trip.Scores?.Overall || trip.Score || 100,
              Events: trip.Events || []
            });
          }
        }

        await db.telematicsDevice.update({
          where: { id: device.id },
          data: { lastSyncAt: endDate }
        });

      } catch (error: any) {
        if (error.response?.status === 404) {
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
