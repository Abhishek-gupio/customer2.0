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
   * Link a mobile SDK instance to a vehicle
   */
  async registerDevice(
    vehicleId: string,
    instanceId: string,
    deviceToken?: string,
    platform?: string,
  ) {
    logger.info({ vehicleId, instanceId }, "Linking Telematics Device");

    // De-activate old devices for this vehicle
    await db.telematicsDevice.updateMany({
      where: { vehicleId },
      data: { isActive: false },
    });

    // Create or update the new device
    return db.telematicsDevice.upsert({
      where: { instanceId },
      update: {
        vehicleId,
        deviceToken,
        platform,
        isActive: true,
      },
      create: {
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
};
