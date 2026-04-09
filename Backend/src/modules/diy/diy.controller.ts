import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { diyService } from "./diy.service";
import { vehicleService } from "../vehicle/vehicle.service";
import { AppError } from "../../utils/AppError";

export const diyController = {
  getGuides: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) throw AppError.unauthorized();

    // 1. Fetch primary vehicle or specific vehicleId from query
    const resolvedVehicleId = (req.query.vehicleId as string) || await vehicleService.resolveVehicleId(customerId);
    
    if (!resolvedVehicleId) {
       // Return default generic guides if no vehicle is found
       const defaultGuides = await diyService.getDefaultGuides();
       return success(res, defaultGuides);
    }

    // 2. Fetch guides
    const guides = await diyService.getGuidesForVehicle(resolvedVehicleId);

    // 3. Optional: Get more category-wise results if needed
    // In production, you might want to paginate or filter these.
    
    success(res, guides);
  }),
};
