import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { AppError } from "../../utils/AppError";
import { parkingService } from "./parking.service";
import {
  employeeLoginSchema,
  checkInWalkInSchema,
  checkOutWalkInSchema,
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

export const employeeController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req, employeeLoginSchema);
    const result = await parkingService.employeeLogin(body);
    success(res, result);
  }),

  listListings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const listings = await parkingService.employeeListListings(req.parkingEmployee.id);
    success(res, listings);
  }),

  listSlotWindows: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const windows = await parkingService.employeeListSlotWindows(req.parkingEmployee.id, req.params.id as string);
    success(res, windows);
  }),

  checkInWalkIn: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const body = parseBody(req, checkInWalkInSchema);
    const walkIn = await parkingService.employeeCheckInWalkIn(
      req.parkingEmployee.id,
      req.params.id as string,
      req.params.slotId as string,
      body,
    );
    success(res, walkIn, 201);
  }),

  checkOutWalkIn: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const body = parseBody(req, checkOutWalkInSchema);
    const walkIn = await parkingService.employeeCheckOutWalkIn(
      req.parkingEmployee.id,
      req.params.walkInId as string,
      body.paymentMethod,
    );
    success(res, walkIn);
  }),

  getListingLiveStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const status = await parkingService.employeeGetListingLiveStatus(req.parkingEmployee.id, req.params.id as string);
    success(res, status);
  }),

  getListingWalkInHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const query = parseQuery(req, paginationSchema);
    const history = await parkingService.employeeGetListingWalkInHistory(req.parkingEmployee.id, req.params.id as string, query);
    success(res, history);
  }),

  listLiveListings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const listings = await parkingService.employeeListLiveListings(req.parkingEmployee.id);
    success(res, listings);
  }),

  listBookings: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const query = parseQuery(req, bookingsListSchema);
    const bookings = await parkingService.employeeListBookings(req.parkingEmployee.id, query);
    success(res, bookings);
  }),

  checkoutBooking: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const booking = await parkingService.employeeCheckoutBooking(req.parkingEmployee.id, req.params.id as string);
    success(res, booking);
  }),

  markBookingNoShow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const booking = await parkingService.employeeMarkBookingNoShow(req.parkingEmployee.id, req.params.id as string);
    success(res, booking);
  }),

  markBookingCheckedIn: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const booking = await parkingService.employeeMarkBookingCheckedIn(req.parkingEmployee.id, req.params.id as string);
    success(res, booking);
  }),

  undoBookingNoShow: asyncHandler(async (req: Request, res: Response) => {
    if (!req.parkingEmployee?.id) throw AppError.unauthorized();
    const booking = await parkingService.employeeUndoBookingNoShow(req.parkingEmployee.id, req.params.id as string);
    success(res, booking);
  }),
};
