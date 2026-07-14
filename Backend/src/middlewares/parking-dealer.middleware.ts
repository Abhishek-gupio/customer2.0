import type { Request, Response, NextFunction } from "express";
import { verifyDealerAccess } from "../modules/parking/parking.jwt";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

/**
 * Verifies a dealer JWT Bearer token and attaches the payload to req.dealer.
 * Structurally identical to adminAuthMiddleware — dealers are a separate
 * role from both Customer (OTP+JWT) and Admin (email+bcrypt+JWT).
 */
export function dealerAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ path: req.path }, "Dealer route: missing or invalid Authorization");
    next(AppError.unauthorized("Missing or invalid Authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.dealer = verifyDealerAccess(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired dealer token"));
  }
}
