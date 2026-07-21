import type { Request, Response, NextFunction } from "express";
import { verifyParkingEmployeeAccess } from "../modules/parking/parking.jwt";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

/**
 * Verifies a parking-employee JWT and attaches the payload to req.parkingEmployee.
 * Structurally identical to dealerAuthMiddleware — a dealer's on-ground staff
 * are a separate, more restricted role from the dealer's own login.
 */
export function parkingEmployeeAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ path: req.path }, "Parking employee route: missing or invalid Authorization");
    next(AppError.unauthorized("Missing or invalid Authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.parkingEmployee = verifyParkingEmployeeAccess(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired employee token"));
  }
}
