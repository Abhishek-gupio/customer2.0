import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { digilockerService } from "./digilocker.service";
import { AppError } from "../../utils/AppError";

export const digilockerController = {
  connect: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    
    // Pass the current host to ensured the mock URL is reachable locally
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const fullBaseUrl = `${protocol}://${host}`;
    
    const result = await digilockerService.getAuthUrl(req.customer.id, fullBaseUrl);
    success(res, result);
  }),

  callback: asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.query;
    if (typeof code !== "string") throw AppError.badRequest("Code missing");

    if (!req.customer?.id) throw AppError.unauthorized();

    const result = await digilockerService.handleCallback(
      req.customer.id,
      code,
    );
    success(res, result);
  }),

  sync: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const { client_id } = req.body || {};
    const result = await digilockerService.syncDocuments(req.customer.id, client_id);
    success(res, result);
  }),
};
