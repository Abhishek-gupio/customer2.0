import { Request, Response } from "express";
import { telematicsService } from "../../services/telematics.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";

export const telematicsController = {
    /**
     * Webhook endpoint for Damoov
     */
    webhook: asyncHandler(async (req: Request, res: Response) => {
        // Validate signature if possible (skipped for MVP)
        const result = await telematicsService.processWebhook(req.body);
        success(res, result);
    }),

    /**
     * Link a device to a vehicle
     */
    linkDevice: asyncHandler(async (req: Request, res: Response) => {
        const { vehicleId } = req.params;
        const { instanceId, deviceToken, platform } = req.body;

        if (!vehicleId || !instanceId) {
            throw AppError.badRequest("vehicleId and instanceId are required");
        }

        const device = await telematicsService.registerDevice(
            vehicleId as string,
            instanceId as string,
            deviceToken as string,
            platform as string
        );
        success(res, { success: true, device });
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

        const result = await telematicsService.getTrips(vehicleId as string, page, limit);
        success(res, result);
    })
};
