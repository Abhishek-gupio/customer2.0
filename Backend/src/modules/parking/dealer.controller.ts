import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { parkingService } from "./parking.service";
import {
  dealerLoginSchema,
  createListingSchema,
  updateListingSchema,
  createSlotWindowsSchema,
} from "./parking.validators";

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

export const dealerController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, dealerLoginSchema);
    const result = await parkingService.dealerLogin(body);
    success(res, result);
  }),

  createListing: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, createListingSchema);
    const listing = await parkingService.createListing(req.dealer.id, body);
    success(res, listing, 201);
  }),

  updateListing: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, updateListingSchema);
    const listing = await parkingService.updateListing(req.dealer.id, req.params.id as string, body);
    success(res, listing);
  }),

  listListings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const listings = await parkingService.listDealerListings(req.dealer.id);
    success(res, listings);
  }),

  createSlotWindows: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, createSlotWindowsSchema);
    const result = await parkingService.createSlotWindows(req.dealer.id, req.params.id as string, body);
    success(res, result, 201);
  }),

  listSlotWindows: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const windows = await parkingService.listSlotWindows(req.dealer.id, req.params.id as string);
    success(res, windows);
  }),

  listBookings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const bookings = await parkingService.listDealerBookings(req.dealer.id);
    success(res, bookings);
  }),
};
