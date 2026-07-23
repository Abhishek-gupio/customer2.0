import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { AppError } from "../utils/AppError";

/**
 * Stricter, route-scoped limiters on top of app.ts's global one — same
 * precedent as messaging-rate-limit.middleware.ts. Booking- and payment-
 * order-creation are worth their own tighter limit specifically: a genuine
 * customer never creates more than a couple of these per minute even while
 * retrying a flaky network, but the generic global limit (300 req/15min)
 * leaves a lot of room for scripted abuse against endpoints that either
 * reserve real capacity (bookings) or hit Razorpay's paid API (orders) —
 * especially the order-creation endpoint, given a customer fully controls
 * `referenceId`/`amountPaise` on it (see payments.service.ts's PARKING_BOOKING
 * comment on why that endpoint's inputs can't be trusted at face value).
 */
function keyByCustomer(req: Request): string {
  return req.customer?.id ?? "anonymous";
}

export const bookingCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: keyByCustomer,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("You're booking too fast — please slow down and try again in a moment"));
  },
});

export const paymentOrderCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: keyByCustomer,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("Too many payment attempts — please slow down and try again in a moment"));
  },
});
