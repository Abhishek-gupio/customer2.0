import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { qrService } from "./qr.service";

export const qrController = {
  getMyToken: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { vehicleId } = req.query as { vehicleId?: string };
    if (!vehicleId) throw AppError.badRequest("vehicleId is required");
    const token = await qrService.getOrCreateToken(req.customer.id, vehicleId);
    success(res, token);
  }),

  rotateToken: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { vehicleId } = req.body as { vehicleId?: string };
    if (!vehicleId) throw AppError.badRequest("vehicleId is required");
    const token = await qrService.rotateToken(req.customer.id, vehicleId);
    success(res, token);
  }),

  resolveToken: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const data = await qrService.resolveToken(req.params.token as string);
    success(res, data);
  }),
};
