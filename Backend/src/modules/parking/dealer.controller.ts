import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { parkingService } from "./parking.service";
import { settlementService } from "./settlement.service";
import {
  dealerLoginSchema,
  createListingSchema,
  updateListingSchema,
  createSlotWindowsSchema,
  createEmployeeSchema,
  checkInWalkInSchema,
  checkOutWalkInSchema,
  setEmployeeListingsSchema,
  bookingsListSchema,
  paginationSchema,
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

function parseQuery<T>(
  req: Request,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): T {
  const result = schema.safeParse(req.query);
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

  uploadPhotos: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const listing = await parkingService.addListingPhotos(req.dealer.id, req.params.id as string, files);
    success(res, listing, 201);
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
    const query = parseQuery(req, bookingsListSchema);
    const bookings = await parkingService.listDealerBookings(req.dealer.id, query);
    success(res, bookings);
  }),

  checkInWalkIn: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, checkInWalkInSchema);
    const walkIn = await parkingService.checkInWalkIn(
      req.dealer.id,
      req.params.id as string,
      req.params.slotId as string,
      body,
    );
    success(res, walkIn, 201);
  }),

  checkOutWalkIn: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, checkOutWalkInSchema);
    const walkIn = await parkingService.checkOutWalkIn(req.dealer.id, req.params.walkInId as string, body.paymentMethod);
    success(res, walkIn);
  }),

  getListingLiveStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const status = await parkingService.dealerGetListingLiveStatus(req.dealer.id, req.params.id as string);
    success(res, status);
  }),

  getListingWalkInHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const query = parseQuery(req, paginationSchema);
    const history = await parkingService.dealerGetListingWalkInHistory(req.dealer.id, req.params.id as string, query);
    success(res, history);
  }),

  listLiveListings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const listings = await parkingService.dealerListLiveListings(req.dealer.id);
    success(res, listings);
  }),

  createEmployee: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, createEmployeeSchema);
    const employee = await parkingService.createEmployee(req.dealer.id, body);
    success(res, employee, 201);
  }),

  listEmployees: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const employees = await parkingService.listEmployees(req.dealer.id);
    success(res, employees);
  }),

  setEmployeeActive: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const isActive = Boolean(req.body?.isActive);
    const employee = await parkingService.setEmployeeActive(req.dealer.id, req.params.employeeId as string, isActive);
    success(res, employee);
  }),

  setEmployeeListings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const body = parseBody(req, setEmployeeListingsSchema);
    const employee = await parkingService.setEmployeeListings(req.dealer.id, req.params.employeeId as string, body.listingIds);
    success(res, employee);
  }),

  checkoutBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const booking = await parkingService.checkoutBooking(req.dealer.id, req.params.id as string);
    success(res, booking);
  }),

  markBookingNoShow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const booking = await parkingService.markBookingNoShow(req.dealer.id, req.params.id as string);
    success(res, booking);
  }),

  markBookingCheckedIn: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const booking = await parkingService.markBookingCheckedIn(req.dealer.id, req.params.id as string);
    success(res, booking);
  }),

  undoBookingNoShow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const booking = await parkingService.undoBookingNoShow(req.dealer.id, req.params.id as string);
    success(res, booking);
  }),

  listSettlements: asyncHandler(async (req: Request, res: Response) => {
    if (!req.dealer?.id) throw AppError.unauthorized();
    const query = parseQuery(req, paginationSchema);
    const settlements = await settlementService.listDealerSettlements(req.dealer.id, query);
    success(res, settlements);
  }),
};
