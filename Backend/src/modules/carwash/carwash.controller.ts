import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { carwashService } from "./carwash.service";
import { searchCentersSchema, getSlotsSchema, createBookingSchema } from "./carwash.validators";

function parseInput<T>(
  raw: unknown,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(raw);
  if (!result.success && result.error) {
    const first = result.error.issues[0]?.message ?? "Validation failed";
    throw AppError.badRequest(first);
  }
  return result.data!;
}

export const carwashController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const query = parseInput(req.query, searchCentersSchema);
    const results = await carwashService.searchCenters(query);
    success(res, results);
  }),

  getCenter: asyncHandler(async (req: Request, res: Response) => {
    const center = await carwashService.getCenterDetail(req.params.id as string);
    success(res, center);
  }),

  getSlots: asyncHandler(async (req: Request, res: Response) => {
    const { date } = parseInput(req.query, getSlotsSchema);
    const slots = await carwashService.getCenterSlots(req.params.id as string, date);
    success(res, slots);
  }),

  listPartners: asyncHandler(async (_req: Request, res: Response) => {
    const partners = await carwashService.listPartners();
    success(res, partners);
  }),

  createBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, createBookingSchema);
    const result = await carwashService.createBooking(req.customer.id, body);
    success(res, result, 201);
  }),

  listMyBookings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const bookings = await carwashService.listMyBookings(req.customer.id);
    success(res, bookings);
  }),

  getBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const booking = await carwashService.getBooking(req.customer.id, req.params.id as string);
    success(res, booking);
  }),

  cancelBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const booking = await carwashService.cancelBooking(req.customer.id, req.params.id as string);
    success(res, booking);
  }),
};
