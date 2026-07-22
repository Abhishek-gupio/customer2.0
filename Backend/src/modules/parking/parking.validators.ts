import { z } from "zod";

// ── Customer-facing ─────────────────────────────────────────────

export const searchListingsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  date: z.coerce.date(),
  startHour: z.coerce.number().int().min(0).max(23),
  endHour: z.coerce.number().int().min(0).max(23),
  radiusKm: z.coerce.number().positive().default(10),
});

export const availabilitySchema = z.object({
  date: z.coerce.date(),
});

export const createBookingSchema = z
  .object({
    listingId: z.string().min(1),
    vehicleId: z.string().min(1, "Select which vehicle you're parking"),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    /** Client-generated, stable across retries of the same tap — prevents double-booking on network retry. */
    idempotencyKey: z.string().min(10).max(100).optional(),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const bookingsListSchema = paginationSchema.extend({
  scope: z.enum(["active", "history"]).default("active"),
  /** Free-text match against vehicle number, customer name/phone, or listing name. */
  q: z.string().trim().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type BookingsListInput = z.infer<typeof bookingsListSchema>;

export const joinWaitlistSchema = z.object({
  listingId: z.string().min(1),
  desiredDate: z.coerce.date(),
});

/** Same shape as joining — leaving needs the same compound key to find the entry. */
export const leaveWaitlistSchema = joinWaitlistSchema;

// ── Dealer-facing ────────────────────────────────────────────────

export const dealerLoginSchema = z.object({
  phoneNumber: z.string().min(6),
  password: z.string().min(1),
});

// ── Admin-facing (Gupio ops onboarding a dealer) ────────────────

export const adminCreateDealerSchema = z.object({
  ownerName: z.string().min(1),
  phoneNumber: z.string().min(6),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

export const createListingSchema = z.object({
  name: z.string().min(1),
  addressLine: z.string().min(1),
  city: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  fourWheelerCapacity: z.coerce.number().int().min(0).default(0),
  twoWheelerCapacity: z.coerce.number().int().min(0).default(0),
  hourlyRatePaise: z.coerce.number().int().positive(),
  dailyRatePaise: z.coerce.number().int().positive().optional(),
  photos: z.array(z.string()).default([]),
});

export const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(["ACTIVE", "PAUSED", "REMOVED"]).optional(),
});

export const createSlotWindowsSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  startHour: z.coerce.number().int().min(0).max(23),
  endHour: z.coerce.number().int().min(0).max(23),
  capacity: z.coerce.number().int().positive(),
});

export const checkInWalkInSchema = z.object({
  vehicleType: z.enum(["CAR", "BIKE"]),
  vehicleNumber: z.string().min(1).max(20),
});

/** Amount isn't collected here — checkOutWalkIn computes it from actual duration parked. */
export const checkOutWalkInSchema = z.object({
  paymentMethod: z.enum(["CASH", "ONLINE"]),
});

export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  phoneNumber: z.string().min(6),
  password: z.string().min(8),
  /** Which lot(s) this employee can see/work — can be empty and assigned later. */
  listingIds: z.array(z.string().min(1)).default([]),
});

export const setEmployeeListingsSchema = z.object({
  listingIds: z.array(z.string().min(1)),
});

// ── Employee-facing (dealer's on-ground staff) ──────────────────

export const employeeLoginSchema = z.object({
  phoneNumber: z.string().min(6),
  password: z.string().min(1),
});

export type SearchListingsInput = z.infer<typeof searchListingsSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
export type LeaveWaitlistInput = z.infer<typeof leaveWaitlistSchema>;
export type DealerLoginInput = z.infer<typeof dealerLoginSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type CreateSlotWindowsInput = z.infer<typeof createSlotWindowsSchema>;
export type AdminCreateDealerInput = z.infer<typeof adminCreateDealerSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type SetEmployeeListingsInput = z.infer<typeof setEmployeeListingsSchema>;
export type EmployeeLoginInput = z.infer<typeof employeeLoginSchema>;
export type CheckInWalkInInput = z.infer<typeof checkInWalkInSchema>;
export type CheckOutWalkInInput = z.infer<typeof checkOutWalkInSchema>;
