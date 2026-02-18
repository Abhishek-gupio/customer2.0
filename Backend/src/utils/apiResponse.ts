import type { Response } from "express";

/**
 * Send a consistent success JSON response.
 */
export function success<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
): Response {
  return res.status(statusCode).json({ success: true, data });
}

/**
 * Send a consistent error JSON response (message + optional code).
 */
export function error(
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
): Response {
  return res.status(statusCode).json({
    success: false,
    error: { message, ...(code && { code }) },
  });
}
