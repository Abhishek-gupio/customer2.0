import type { Request, Response, NextFunction } from "express";

/**
 * Placeholder auth middleware. In production, verify JWT/session and attach user to req.
 * Currently allows all requests; replace with real auth (e.g. verify Bearer token).
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  // TODO: validate token and set req.user (e.g. from JWT)
  if (authHeader?.startsWith("Bearer ")) {
    // const token = authHeader.slice(7);
    // req.user = await verifyToken(token);
  }
  next();
}
