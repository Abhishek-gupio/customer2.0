import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../modules/auth/jwt";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

/**
 * Verifies JWT Bearer token and attaches customer payload to req.customer.
 * Use on routes that require authentication.
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ path: req.path, hasAuth: !!authHeader }, "Unauthenticated request blocked");
    next(AppError.unauthorized("Missing or invalid Authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.customer = verifyAccess(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
}
