import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { digilockerService } from "./digilocker.service";
import { AppError } from "../../utils/AppError";

function encodeState(customerId: string): string {
  return Buffer.from(
    JSON.stringify({
      customerId,
      nonce: Math.random().toString(36).slice(2),
    }),
  ).toString("base64url");
}

function decodeCustomerIdFromState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { customerId?: string };
    return parsed.customerId ?? null;
  } catch {
    return null;
  }
}

export const digilockerController = {
  connect: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const state = encodeState(req.customer.id);
    const url = digilockerService.getAuthUrl(state);
    success(res, { url });
  }),

  callback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;
    if (typeof code !== "string") throw AppError.badRequest("Code missing");

    const customerId =
      req.customer?.id ||
      (typeof state === "string" ? decodeCustomerIdFromState(state) : null);
    if (!customerId) throw AppError.unauthorized();

    const result = await digilockerService.handleCallback(customerId, code);
    success(res, result);
  }),

  sync: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const result = await digilockerService.syncDocuments(req.customer.id);
    success(res, result);
  }),
};
