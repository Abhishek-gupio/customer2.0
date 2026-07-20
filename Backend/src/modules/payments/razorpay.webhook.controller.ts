import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { paymentsService } from "./payments.service";

/**
 * No authMiddleware — Razorpay calls this directly. Trust boundary is the
 * signature check inside paymentsService.processWebhook, verified against
 * req.rawBody (the exact bytes Razorpay signed; see app.ts's express.json
 * `verify` hook).
 */
export const razorpayWebhookController = {
  handle: asyncHandler(async (req: Request, res: Response) => {
    if (!req.rawBody) {
      throw AppError.internal("Raw request body unavailable for signature verification");
    }
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const result = await paymentsService.processWebhook(req.rawBody, signature);
    res.status(200).json({ success: true, ...result });
  }),
};
