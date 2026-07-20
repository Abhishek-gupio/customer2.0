import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { parkingService } from "./parking.service";
import { adminCreateDealerSchema } from "./parking.validators";

function parseBody<T>(
  req: Request,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(req.body);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

/**
 * Gupio ops onboarding a parking-lot operator. There is no dealer self-signup —
 * the plan's own risk note calls this a business/ops decision, not an
 * engineering one, so this is deliberately manual, admin-triggered creation.
 */
export const adminDealerController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, adminCreateDealerSchema);
    const dealer = await parkingService.adminCreateDealer(body);
    success(res, dealer, 201);
  }),

  list: asyncHandler(async (_req: Request, res: Response) => {
    const dealers = await parkingService.adminListDealers();
    success(res, dealers);
  }),
};
