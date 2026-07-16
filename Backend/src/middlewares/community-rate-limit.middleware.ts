import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { AppError } from "../utils/AppError";

function keyByCustomer(req: Request): string {
  return req.customer?.id ?? "anonymous";
}

/** Spam protection for post creation — mirrors messageSendLimiter's shape. */
export const postCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: keyByCustomer,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("You're posting too fast — please slow down"));
  },
});

/** Looser limiter for comments/reactions — higher-frequency, lower-risk actions. */
export const commentCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: keyByCustomer,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests("You're commenting too fast — please slow down"));
  },
});
