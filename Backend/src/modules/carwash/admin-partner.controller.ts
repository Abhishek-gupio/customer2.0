import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { carwashService } from "./carwash.service";
import { adminCreatePartnerSchema } from "./carwash.validators";

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
 * Gupio ops onboarding a wash partner business. There is no partner
 * self-signup — same deliberate manual, admin-triggered creation as the
 * Parking dealer pattern.
 */
export const adminPartnerController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, adminCreatePartnerSchema);
    const partner = await carwashService.adminCreatePartner(body);
    success(res, partner, 201);
  }),

  list: asyncHandler(async (_req: Request, res: Response) => {
    const partners = await carwashService.adminListPartners();
    success(res, partners);
  }),
};
