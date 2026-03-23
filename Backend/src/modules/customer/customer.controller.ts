import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { customerService } from "./customer.service";
import {
  registerDeviceSchema,
  updateProfileSchema,
} from "./customer.validators";
import { AppError } from "../../utils/AppError";

function parseBody<T>(
  req: Request,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(req.body);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const customerController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) {
      throw AppError.unauthorized();
    }
    const data = await customerService.getProfile(customerId);
    success(res, data);
  }),

  getProfileStats: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) {
      throw AppError.unauthorized();
    }
    const data = await customerService.getProfileStats(customerId);
    success(res, data);
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) {
      throw AppError.unauthorized();
    }
    const body = parseBody(req, updateProfileSchema);
    const data = await customerService.updateProfile(customerId, body);
    success(res, data);
  }),

  uploadProfilePicture: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) {
      throw AppError.unauthorized();
    }
    if (!req.file) {
      throw AppError.badRequest("No image file uploaded");
    }
    const data = await customerService.uploadProfilePicture(customerId, req.file);
    success(res, data);
  }),

  registerDevice: asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.customer?.id;
    if (!customerId) {
      throw AppError.unauthorized();
    }
    const body = parseBody(req, registerDeviceSchema);
    const data = await customerService.registerDevice(customerId, body);
    success(res, data, 201);
  }),
};
