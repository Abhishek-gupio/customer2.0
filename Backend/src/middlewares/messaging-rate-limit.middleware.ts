import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { AppError } from "../utils/AppError";

/**
 * Stricter, route-scoped limiter on top of app.ts's global one — this
 * codebase had no precedent for a second limiter before this feature, so
 * this is the first. Keyed by the authenticated customerId (authMiddleware
 * runs before this in messaging.routes.ts, so req.customer is always set).
 */
function keyByCustomer(req: Request): string {
  return req.customer?.id ?? "anonymous";
}

/** "Rate limit messages" — spam protection. */
export const messageSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: keyByCustomer,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("You're sending messages too fast — please slow down"));
  },
});

/**
 * The guest web page has no account/JWT at all — IP is the only signal.
 * Deliberately tighter than the authenticated limiter above since an
 * anonymous, unauthenticated endpoint is a much easier spam target.
 */
export const guestMessageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown"),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("Too many messages from this device — please try again later"));
  },
});
