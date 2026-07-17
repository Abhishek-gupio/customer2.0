import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { carwashService } from "./carwash.service";
import { technicianLoginSchema } from "./carwash.validators";

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

export const technicianController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, technicianLoginSchema);
    const result = await carwashService.technicianLogin(body);
    success(res, result);
  }),

  listJobs: asyncHandler(async (req: Request, res: Response) => {
    if (!req.technician?.id) throw AppError.unauthorized();
    const jobs = await carwashService.listMyTechnicianJobs(req.technician.id);
    success(res, jobs);
  }),

  uploadBeforePhotos: asyncHandler(async (req: Request, res: Response) => {
    if (!req.technician?.id) throw AppError.unauthorized();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const job = await carwashService.uploadBeforePhotos(req.technician.id, req.params.id as string, files);
    success(res, job);
  }),

  completeJob: asyncHandler(async (req: Request, res: Response) => {
    if (!req.technician?.id) throw AppError.unauthorized();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const job = await carwashService.completeJob(req.technician.id, req.params.id as string, files);
    success(res, job);
  }),
};
