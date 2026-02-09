import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { authService } from "./auth.service";
import {
  loginSchema,
  sendOtpSchema,
  signupSchema,
  verifyOtpSchema,
} from "./auth.validators";
import { AppError } from "../../utils/AppError";

function parseBody<T>(
  req: Request,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }
): T {
  const result = schema.safeParse(req.body);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, signupSchema);
    const data = await authService.signup(body);
    success(res, data, 201);
  }),

  sendOtp: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, sendOtpSchema);
    const data = await authService.sendOtp(body.phoneNumber);
    success(res, data);
  }),

  verifyOtp: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, verifyOtpSchema);
    const data = await authService.verifyOtp(body);
    success(res, data);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, loginSchema);
    const data = await authService.login(body.phoneNumber);
    success(res, data);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body?.refreshToken ?? req.headers["x-refresh-token"];
    if (typeof refreshToken !== "string") {
      throw AppError.badRequest("refreshToken required");
    }
    const data = await authService.refresh(refreshToken);
    success(res, data);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body?.refreshToken ?? req.headers["x-refresh-token"];
    const data = await authService.logout(
      typeof refreshToken === "string" ? refreshToken : undefined
    );
    success(res, data);
  }),
};
