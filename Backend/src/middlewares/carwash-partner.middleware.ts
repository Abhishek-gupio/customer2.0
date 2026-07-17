import type { Request, Response, NextFunction } from "express";
import { verifyPartnerAccess } from "../modules/carwash/carwash.jwt";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

/**
 * Verifies a wash-partner JWT Bearer token and attaches the payload to
 * req.partner. Structurally identical to dealerAuthMiddleware — wash
 * partners are a separate role from Customer, Admin, and Dealer.
 */
export function partnerAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ path: req.path }, "Partner route: missing or invalid Authorization");
    next(AppError.unauthorized("Missing or invalid Authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.partner = verifyPartnerAccess(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired partner token"));
  }
}
