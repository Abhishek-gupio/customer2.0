import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { sharingService } from "./sharing.service";
import { shareVehicleSchema } from "./sharing.validators";
import { AppError } from "../../utils/AppError";

export const sharingController = {
  share: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = shareVehicleSchema.parse(req.body);
    const access = await sharingService.shareVehicle(req.customer.id, body);
    success(res, access, 201);
  }),

  listIncoming: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const shared = await sharingService.listSharedWithMe(req.customer.id);
    success(res, shared);
  }),

  listOutgoing: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const sharings = await sharingService.listVehicleSharings(
      req.customer.id,
      req.params.vehicleId as string,
    );
    success(res, sharings);
  }),

  revoke: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { vehicleId, targetCustomerId } = req.params;
    const result = await sharingService.revokeAccess(
      req.customer.id,
      vehicleId as string,
      targetCustomerId as string,
    );
    success(res, result);
  }),
};
