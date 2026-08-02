import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { AppError } from "../utils/AppError";

/**
 * Route-scoped limiter for the AI surface, on top of app.ts's global limiter — same precedent as
 * booking-rate-limit.middleware.ts and messaging-rate-limit.middleware.ts.
 *
 * The AI endpoints need their own tighter limit because, unlike a normal read, each request costs
 * real money and can trigger *further* paid calls: one message may fan out to a planner call, an
 * embedding, a rerank, up to five tool-calling iterations, and — via the flows — third-party APIs
 * that bill per request (IDSPay verification, TollGuru). The global limit of 300 requests per 15
 * minutes leaves ample room for an authenticated user to drive unbounded spend, deliberately or
 * through a client retry loop.
 *
 * Keyed per customer rather than per IP: these routes sit behind `authMiddleware`, and a shared
 * NAT/carrier IP would otherwise let one abuser exhaust the budget for everyone behind it.
 *
 * 20/minute is far above real conversational use (a person sends a handful of messages a minute,
 * even while dictating) and still caps the worst case to something survivable.
 */
function keyByCustomer(req: Request): string {
  return req.customer?.id ?? "anonymous";
}

export const aiMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: keyByCustomer,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      AppError.tooManyRequests(
        "You're sending messages faster than I can answer — please wait a moment and try again",
      ),
    );
  },
});
