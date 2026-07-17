import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { carwashService } from "./carwash.service";
import {
  partnerLoginSchema,
  createTechnicianSchema,
  createCenterSchema,
  createSlotsSchema,
  assignTechnicianSchema,
} from "./carwash.validators";

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

export const partnerController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, partnerLoginSchema);
    const result = await carwashService.partnerLogin(body);
    success(res, result);
  }),

  createTechnician: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const body = parseBody(req, createTechnicianSchema);
    const technician = await carwashService.createTechnician(req.partner.id, body);
    success(res, technician, 201);
  }),

  listTechnicians: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const technicians = await carwashService.listTechnicians(req.partner.id);
    success(res, technicians);
  }),

  createCenter: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const body = parseBody(req, createCenterSchema);
    const center = await carwashService.createCenter(req.partner.id, body);
    success(res, center, 201);
  }),

  listCenters: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const centers = await carwashService.listPartnerCenters(req.partner.id);
    success(res, centers);
  }),

  createSlots: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const body = parseBody(req, createSlotsSchema);
    const result = await carwashService.createSlots(req.partner.id, req.params.id as string, body);
    success(res, result, 201);
  }),

  listSlots: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const slots = await carwashService.listCenterSlots(req.partner.id, req.params.id as string);
    success(res, slots);
  }),

  listJobs: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const jobs = await carwashService.listPartnerJobs(req.partner.id);
    success(res, jobs);
  }),

  assignTechnician: asyncHandler(async (req: Request, res: Response) => {
    if (!req.partner?.id) throw AppError.unauthorized();
    const body = parseBody(req, assignTechnicianSchema);
    const job = await carwashService.assignTechnician(req.partner.id, req.params.id as string, body.technicianId);
    success(res, job);
  }),
};
