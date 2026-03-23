import type { Request, Response, NextFunction } from "express";
import { verifyAdminAccess } from "../modules/admin/admin.jwt";
import type { AdminRole } from "@repo/db-customer";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";

/**
 * Verifies Admin JWT Bearer token and attaches admin payload to req.admin.
 * Use on routes that require admin authentication.
 */
export function adminAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ path: req.path }, "Admin route: missing or invalid Authorization");
    next(AppError.unauthorized("Missing or invalid Authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.admin = verifyAdminAccess(token);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired admin token"));
  }
}

/**
 * Restricts access to given roles. Use after adminAuthMiddleware.
 */
export function requireAdminRole(allowedRoles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      next(AppError.unauthorized("Admin authentication required"));
      return;
    }
    if (!allowedRoles.includes(req.admin.role)) {
      next(AppError.forbidden("Insufficient permissions"));
      return;
    }
    next();
  };
}
