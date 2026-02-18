import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { digilockerService } from "./digilocker.service";
import { AppError } from "../../utils/AppError";

export const digilockerController = {
  connect: asyncHandler(async (req: Request, res: Response) => {
    const state = Math.random().toString(36).substring(7); // Basic CSRF state
    const url = digilockerService.getAuthUrl(state);
    success(res, { url });
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
    const result = await digilockerService.syncDocuments(req.customer.id);
    success(res, result);
  }),
};
