import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { AppError } from "../utils/AppError";

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, ...(err.code && { code: err.code }) },
    });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: { message: "Internal server error" },
  });
}
