import type { Request, Response, NextFunction } from "express";
import { verifyTechnicianAccess } from "../modules/carwash/carwash.jwt";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

/**
 * Verifies a technician JWT Bearer token and attaches the payload to
 * req.technician. Structurally identical to partnerAuthMiddleware —
 * technicians are a separate role from Customer, Admin, Dealer, and Partner.
 */
export function technicianAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ path: req.path }, "Technician route: missing or invalid Authorization");
    next(AppError.unauthorized("Missing or invalid Authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.technician = verifyTechnicianAccess(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired technician token"));
  }
}
