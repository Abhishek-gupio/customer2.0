import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { parkingService } from "./parking.service";
import {
  searchListingsSchema,
  availabilitySchema,
  createBookingSchema,
  joinWaitlistSchema,
} from "./parking.validators";

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

export const parkingController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const query = parseInput(req.query, searchListingsSchema);
    const results = await parkingService.searchListings(query);
    success(res, results);
  }),

  getListing: asyncHandler(async (req: Request, res: Response) => {
    const listing = await parkingService.getListingDetail(req.params.id as string);
    success(res, listing);
  }),

  getAvailability: asyncHandler(async (req: Request, res: Response) => {
    const { date } = parseInput(req.query, availabilitySchema);
    const availability = await parkingService.getAvailability(req.params.id as string, date);
    success(res, availability);
  }),

  createBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, createBookingSchema);
    const result = await parkingService.createBooking(req.customer.id, body);
    success(res, result, 201);
  }),

  listMyBookings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const bookings = await parkingService.listMyBookings(req.customer.id);
    success(res, bookings);
  }),

  cancelBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const booking = await parkingService.cancelBooking(req.customer.id, req.params.id as string);
    success(res, booking);
  }),

  joinWaitlist: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const body = parseInput(req.body, joinWaitlistSchema);
    const entry = await parkingService.joinWaitlist(req.customer.id, body);
    success(res, entry, 201);
  }),

  getExtraPayment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.customer?.id) throw AppError.unauthorized();
    const payment = await parkingService.getExtraPaymentInfo(req.customer.id, req.params.id as string);
    success(res, payment);
  }),
};
