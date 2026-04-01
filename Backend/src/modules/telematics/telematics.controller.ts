import { Request, Response } from "express";
import { telematicsService } from "../../services/telematics.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";

export const telematicsController = {
  /**
   * Register a user with Damoov
   */
  register: asyncHandler(async (req: Request, res: Response) => {
    const { clientCustomId, provider } = req.body;

    if (!clientCustomId) {
      throw AppError.badRequest("clientCustomId is required");
    }

    const result = await telematicsService.registerUser(
      clientCustomId as string,
      provider,
    );
    success(res, result);
  }),

  /**
   * Webhook endpoint for Damoov
   */
  webhook: asyncHandler(async (req: Request, res: Response) => {
    if (env.DAMOOV_WEBHOOK_SECRET) {
      const signature = req.headers["x-damoov-signature"];
      if (signature !== env.DAMOOV_WEBHOOK_SECRET) {
        throw AppError.unauthorized("Invalid Damoov webhook signature");
      }
    }
    const result = await telematicsService.processWebhook(req.body);
    success(res, result);
  }),

  /**
   * Link a device to a vehicle
   */
  linkDevice: asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;
    const { instanceId, deviceToken, platform, provider } = req.body;

    if (!vehicleId || !instanceId) {
      throw AppError.badRequest("vehicleId and instanceId are required");
    }

    const device = await telematicsService.registerDevice(
      vehicleId as string,
      instanceId as string,
      deviceToken as string,
      platform as string,
      provider,
    );
    success(res, { success: true, device });
  }),

  /**
   * In-house telematics: ingest finalized trip payload.
   * This is the first step of in-house rollout and allows mobile-side trackers
   * to push processed trips directly to our backend.
   */
  ingestInHouseTrip: asyncHandler(async (req: Request, res: Response) => {
    const result = await telematicsService.ingestInHouseTrip(req.body ?? {});
    success(res, result);
  }),

  /**
   * Get Trip History
   */
  getTrips: asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!vehicleId) {
      throw AppError.badRequest("Vehicle ID is required");
    }

    const result = await telematicsService.getTrips(
      vehicleId as string,
      page,
      limit,
    );
    success(res, result);
  }),

  /**
   * Get GPS path for a single trip
   */
  getTripPath: asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params;

    if (!tripId) {
      throw AppError.badRequest("tripId is required");
    }

    const data = await telematicsService.getTripPathById(tripId as string);
    success(res, data);
  }),

  /**
   * A5: Get end-trip summary with score + money tip + safety tip
   */
  getTripSummary: asyncHandler(async (req: Request, res: Response) => {
    const { tripId } = req.params;

    if (!tripId) {
      throw AppError.badRequest("tripId is required");
    }

    const data = await telematicsService.getTripSummaryById(tripId as string);
    success(res, data);
  }),
  /**
   * Manual sync with Damoov
   */
  sync: asyncHandler(async (req: Request, res: Response) => {
    const provider = req.body?.provider;
    const syncResult = await telematicsService.syncTripsForProvider(provider, {
      forceLogin: true,
    });
    success(res, {
      success: true,
      message:
        syncResult.status === "skipped_external_sync"
          ? "In-house provider selected; external sync skipped"
          : "Sync completed",
      provider: syncResult.provider,
    });
  }),
};
