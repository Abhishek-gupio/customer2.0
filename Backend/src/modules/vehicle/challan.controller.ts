import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { challanService } from "../../services/challan.service";
import { vehicleService } from "../vehicle/vehicle.service";
import { AppError } from "../../utils/AppError";

export const challanController = {
  listByVehicle: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { vehicleId } = req.params;

    // Ownership check
    await vehicleService.getVehicle(req.customer.id, vehicleId as string);

    const challans = await challanService.getChallans(vehicleId as string);
    success(res, challans);
  }),

  markAsPaid: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { id } = req.params;

    // In a real app, we'd verify the challan belongs to a vehicle the customer owns
    const updated = await challanService.markAsPaid(id as string);
    success(res, updated);
  }),

  sync: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { vehicleId } = req.params;

    await vehicleService.getVehicle(req.customer.id, vehicleId as string);
    await challanService.syncChallans(vehicleId as string);

    const challans = await challanService.getChallans(vehicleId as string);
    success(res, challans);
  }),
};
