import bcrypt from "bcryptjs";
import { dbInstances, type ParkingVehicleType, type ParkingPaymentMethod } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { getSMSService } from "../../services/sms.service";
import { storageService } from "../../services/storage.service";
import { paymentEvents } from "../../services/payment-events";
import { paymentsService } from "../payments/payments.service";
import { getIO, PARKING_ADMIN_ROOM } from "../../socket";
import {
  signDealerAccess,
  getDealerAccessExpirySeconds,
  signParkingEmployeeAccess,
  getParkingEmployeeAccessExpirySeconds,
} from "./parking.jwt";
import type {
  SearchListingsInput,
  CreateBookingInput,
  JoinWaitlistInput,
  LeaveWaitlistInput,
  DealerLoginInput,
  CreateListingInput,
  UpdateListingInput,
  CreateSlotWindowsInput,
  AdminCreateDealerInput,
  CreateEmployeeInput,
  EmployeeLoginInput,
  CheckInWalkInInput,
  PaginationInput,
  BookingsListInput,
} from "./parking.validators";

/**
 * Pushes a "something changed" ping — the dealer's room (which every one of
 * their employees also joins) and the global admin feed. Deliberately no
 * payload beyond the listing id: clients just refetch getListingLiveStatus,
 * keeping this the only place that needs to know the room-naming scheme.
 */
function emitParkingLiveUpdate(dealerId: string, listingId: string): void {
  try {
    getIO().to(dealerId).to(PARKING_ADMIN_ROOM).emit("parking_live_update", { dealerId, listingId });
  } catch (err) {
    // Socket.io may not be initialized in some contexts (e.g. tests) — live
    // updates are a nice-to-have, never worth failing the underlying action.
    logger.warn({ err, dealerId, listingId }, "Could not emit parking_live_update");
  }
}

const SALT_ROUNDS = 10;
/** Cancelling within this window of the booking start time is not allowed. */
const CANCELLATION_WINDOW_MS = 60 * 60 * 1000;
/** A PENDING_PAYMENT booking older than this with no payment activity releases its hold. */
const ABANDONED_HOLD_MS = 10 * 60 * 1000;
/**
 * A CONFIRMED booking whose customer never showed can be marked no-show —
 * manually by the dealer/employee, or automatically by the sweep below —
 * this long after `startTime`. No refund: the slot was held for them.
 */
const NO_SHOW_GRACE_MS = 15 * 60 * 1000;

/** Haversine distance in km — same approach as services/places.service.ts. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function hoursBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (60 * 60 * 1000)));
}

/**
 * This product only serves customers in India — slot windows are created by
 * dealers using plain IST wall-clock hours (e.g. "6 to 22" meaning 6am-10pm
 * IST), with no timezone conversion on their end. A booking's `startTime`/
 * `endTime` arrive as real UTC instants (via .toISOString() from the app),
 * so reading `.getUTCHours()` directly gives the wrong hour whenever the
 * server process isn't itself running in IST (commonly UTC in prod) — IST is
 * UTC+5:30, so an 11am IST booking's raw UTC hour is 5, which then fails to
 * match a dealer's "starts at 6" window even though 11am is well within it.
 * Shifting by the fixed IST offset first makes `.getUTCHours()`/date getters
 * read back the intended IST wall-clock values regardless of server TZ.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function toIstShifted(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/**
 * Waitlist entries must key off the same calendar-day boundary that
 * notifyWaitlistForFreedCapacity queries against (`Date.UTC(y, m, d)`,
 * exact midnight) — the client sends a real Date with whatever time-of-day
 * it happened to be constructed at (e.g. `new Date()`), so without this the
 * stored `desiredDate` almost never matches that exact-midnight lookup and
 * a waitlisted customer would silently never get notified.
 */
function toDayStartUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function findCoveringSlotWindow(listingId: string, date: Date, startHour: number, endHour: number) {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return dbInstances.parkingSlotWindow.findFirst({
    where: {
      listingId,
      date: dayStart,
      startHour: { lte: startHour },
      endHour: { gte: endHour },
    },
  });
}

/** True if `err` is a Prisma unique-constraint violation (P2002) on the given field. */
/**
 * This project's Prisma client runs in driver-adapter mode (@prisma/adapter-pg),
 * which — verified empirically, not assumed — puts the actual violated-field
 * list under `meta.driverAdapterError.cause.constraint.fields`, NOT the
 * classic top-level `meta.target` this function used to check exclusively.
 * That meant it never matched anything in practice: every P2002 on
 * idempotencyKey fell through to a bare rethrow instead of the graceful
 * "find and return the winning booking" recovery path it exists for. Both
 * shapes are checked now so this keeps working if that ever changes back.
 */
function isUniqueConstraintOn(err: unknown, field: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code !== "P2002") return false;
  const meta = (err as { meta?: any }).meta;
  const driverFields: unknown = meta?.driverAdapterError?.cause?.constraint?.fields;
  const target = meta?.target;
  const candidates = [
    ...(Array.isArray(driverFields) ? driverFields : []),
    ...(Array.isArray(target) ? target : typeof target === "string" ? [target] : []),
  ];
  // Driver-adapter field names come back double-quoted, e.g. `"idempotencyKey"`.
  return candidates.some((c) => typeof c === "string" && c.replace(/"/g, "") === field);
}

/**
 * Same idea as isUniqueConstraintOn, but for a unique constraint that's a
 * plain named database index (e.g. one created by hand-written migration
 * SQL, not a Prisma-schema-level `@unique`) — those report via
 * `constraint.index` rather than `constraint.fields`.
 */
function isUniqueConstraintOnIndex(err: unknown, indexName: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code !== "P2002") return false;
  const meta = (err as { meta?: any }).meta;
  const index: unknown = meta?.driverAdapterError?.cause?.constraint?.index;
  return index === indexName;
}

/** Atomic check-and-increment — Prisma's filter DSL can't compare two columns of the same row. */
async function reserveCapacity(slotWindowId: string): Promise<boolean> {
  const result = await dbInstances.$queryRaw<{ id: string }[]>`
    UPDATE "customer"."ParkingSlotWindow"
    SET "booked" = "booked" + 1
    WHERE "id" = ${slotWindowId} AND "booked" < "capacity"
    RETURNING "id"
  `;
  return result.length > 0;
}

async function releaseCapacity(slotWindowId: string): Promise<void> {
  await dbInstances.$executeRaw`
    UPDATE "customer"."ParkingSlotWindow"
    SET "booked" = GREATEST("booked" - 1, 0)
    WHERE "id" = ${slotWindowId}
  `;
}

/**
 * Walk-in occupancy, tracked separately per vehicle type and separately from
 * `booked` (app bookings) so a dealer/employee marking a physical bay
 * occupied/free can never corrupt an app customer's reservation. Bounded
 * atomically against remaining capacity (cars + bikes + app bookings share
 * one capacity pool — dealers set one combined bay count).
 */
async function occupyCapacityManually(slotWindowId: string, vehicleType: ParkingVehicleType): Promise<boolean> {
  const result =
    vehicleType === "CAR"
      ? await dbInstances.$queryRaw<{ id: string }[]>`
          UPDATE "customer"."ParkingSlotWindow"
          SET "manualOccupiedCars" = "manualOccupiedCars" + 1
          WHERE "id" = ${slotWindowId}
            AND ("booked" + "manualOccupiedCars" + "manualOccupiedBikes") < "capacity"
          RETURNING "id"
        `
      : await dbInstances.$queryRaw<{ id: string }[]>`
          UPDATE "customer"."ParkingSlotWindow"
          SET "manualOccupiedBikes" = "manualOccupiedBikes" + 1
          WHERE "id" = ${slotWindowId}
            AND ("booked" + "manualOccupiedCars" + "manualOccupiedBikes") < "capacity"
          RETURNING "id"
        `;
  return result.length > 0;
}

async function vacateCapacityManually(slotWindowId: string, vehicleType: ParkingVehicleType): Promise<void> {
  if (vehicleType === "CAR") {
    await dbInstances.$executeRaw`
      UPDATE "customer"."ParkingSlotWindow"
      SET "manualOccupiedCars" = GREATEST("manualOccupiedCars" - 1, 0)
      WHERE "id" = ${slotWindowId}
    `;
  } else {
    await dbInstances.$executeRaw`
      UPDATE "customer"."ParkingSlotWindow"
      SET "manualOccupiedBikes" = GREATEST("manualOccupiedBikes" - 1, 0)
      WHERE "id" = ${slotWindowId}
    `;
  }
}

async function notifyWaitlistForFreedCapacity(listingId: string, date: Date): Promise<void> {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const entries = await dbInstances.parkingWaitlistEntry.findMany({
    where: { listingId, desiredDate: dayStart, notified: false },
    include: { customer: true },
  });
  for (const entry of entries) {
    try {
      await notificationService.notifyCustomer(entry.customerId, {
        title: "A parking spot opened up",
        body: "A spot you were waitlisted for is now available — book it before it's gone.",
        type: "PARKING",
        link: `/parking/listings/${listingId}`,
        metadata: { listingId },
      });
      await dbInstances.parkingWaitlistEntry.update({
        where: { id: entry.id },
        data: { notified: true },
      });
    } catch (err) {
      logger.error({ err, entryId: entry.id }, "Failed to notify waitlist entry");
    }
  }
}

async function expireOneAbandonedBooking(booking: { id: string; slotWindowId: string; listingId: string; startTime: Date; listing: { dealerId: string } }): Promise<void> {
  // updateMany + a status guard makes this the atomic compare-and-swap that
  // decides who "wins" — two concurrent callers racing the same stale-read
  // booking (e.g. the inline lazy-expiry check and the BullMQ sweep firing
  // moments apart) can no longer both transition it and both release
  // capacity, which would free more capacity than the slot actually has.
  const { count } = await dbInstances.parkingBooking.updateMany({
    where: { id: booking.id, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) return;
  await releaseCapacity(booking.slotWindowId);
  await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
  emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);
}

/**
 * Frees the capacity a no-show booking was holding, so someone else can book
 * or walk into that same slot instead of it sitting reserved for nobody for
 * the rest of the day. No refund — see markBookingNoShow.
 */
async function markOneBookingNoShow(booking: { id: string; slotWindowId: string; listingId: string; startTime: Date; listing: { dealerId: string } }): Promise<void> {
  // Same compare-and-swap shape as expireOneAbandonedBooking above — only
  // the caller that actually flips CONFIRMED → NO_SHOW gets to release
  // capacity, so a concurrent manual no-show + the auto-sweep racing the
  // same booking can't double-decrement.
  const { count } = await dbInstances.parkingBooking.updateMany({
    where: { id: booking.id, status: "CONFIRMED" },
    data: { status: "NO_SHOW" },
  });
  if (count === 0) return;
  await releaseCapacity(booking.slotWindowId);
  await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
  emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);
}

/**
 * Defense-in-depth: the BullMQ sweep (releaseAbandonedBookings below) is the
 * primary mechanism, but it silently does nothing if Redis/BullMQ isn't
 * configured (see config/queue.ts's isQueueEnabled). Calling this inline at
 * the moments that actually matter — right before reserving capacity, and
 * when a customer is looking at availability — means a stale PENDING_PAYMENT
 * hold gets cleared the next time anyone touches that slot, even if the
 * background job never runs at all.
 */
/**
 * Shared by listDealerBookings/employeeListBookings: turns the optional
 * `q`/`from`/`to` filters into extra Prisma AND-clauses layered on top of
 * each caller's own scope filter. `vehicleNumber` isn't a Prisma relation
 * (see ParkingBooking's vehicleId comment), so a text search on it has to
 * resolve matching CustomerVehicle ids first, then filter bookings by
 * `vehicleId IN (...)` — same reason getListingLiveStatus/listDealerBookings
 * already join vehicle numbers back in manually after the query.
 */
async function buildBookingsSearchClauses(listInput?: BookingsListInput): Promise<Record<string, unknown>[]> {
  const clauses: Record<string, unknown>[] = [];

  if (listInput?.from || listInput?.to) {
    clauses.push({
      startTime: {
        ...(listInput.from ? { gte: listInput.from } : {}),
        ...(listInput.to ? { lte: listInput.to } : {}),
      },
    });
  }

  if (listInput?.q) {
    const q = listInput.q;
    const matchingVehicles = await dbInstances.customerVehicle.findMany({
      where: { registrationNumber: { contains: q, mode: "insensitive" } },
      select: { id: true },
    });
    clauses.push({
      OR: [
        { customer: { fullName: { contains: q, mode: "insensitive" } } },
        { customer: { phoneNumber: { contains: q, mode: "insensitive" } } },
        { listing: { name: { contains: q, mode: "insensitive" } } },
        ...(matchingVehicles.length ? [{ vehicleId: { in: matchingVehicles.map((v) => v.id) } }] : []),
      ],
    });
  }

  return clauses;
}

/**
 * Live-occupancy counts (app bookings + walk-ins currently parked) for a set
 * of listings, in exactly 2 queries total regardless of how many listings
 * are passed in — used by every "list of listings with a live count" screen
 * (dealer's, employee's, and the platform-wide admin one), which previously
 * each called the full getListingLiveStatus (itself 3-4 queries, including
 * joined customer/vehicle/employee data this summary never uses) once PER
 * LISTING via Promise.all — a 20-listing dealer fired ~60-80 concurrent
 * queries for one dashboard load, and the admin variant did the same
 * unbounded fan-out across every listing on the entire platform.
 */
async function countLiveOccupancyByListing<T extends { id: string }>(
  listings: T[],
): Promise<Array<T & { appCount: number; walkInCount: number }>> {
  const listingIds = listings.map((l) => l.id);
  if (listingIds.length === 0) return [];

  const [bookingCounts, walkInCounts] = await Promise.all([
    dbInstances.parkingBooking.groupBy({
      by: ["listingId"],
      where: { listingId: { in: listingIds }, status: "CONFIRMED", actualCheckOutTime: null },
      _count: { _all: true },
    }),
    dbInstances.parkingWalkIn.groupBy({
      by: ["listingId"],
      where: { listingId: { in: listingIds }, exitedAt: null },
      _count: { _all: true },
    }),
  ]);

  const appCountByListing = new Map(bookingCounts.map((b) => [b.listingId, b._count._all]));
  const walkInCountByListing = new Map(walkInCounts.map((w) => [w.listingId, w._count._all]));

  return listings.map((l) => ({
    ...l,
    appCount: appCountByListing.get(l.id) ?? 0,
    walkInCount: walkInCountByListing.get(l.id) ?? 0,
  }));
}

async function expireAbandonedBookingsForSlotWindow(slotWindowId: string): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONED_HOLD_MS);
  const abandoned = await dbInstances.parkingBooking.findMany({
    where: { slotWindowId, status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    include: { listing: { select: { dealerId: true } } },
  });
  for (const booking of abandoned) {
    try {
      await expireOneAbandonedBooking(booking);
    } catch (err) {
      logger.error({ err, bookingId: booking.id }, "Failed to lazily expire abandoned parking booking");
    }
  }
}

export const parkingService = {
  // ── Customer-facing ────────────────────────────────────────────

  async searchListings(input: SearchListingsInput) {
    const boxDegrees = input.radiusKm / 111; // ~111km per degree latitude, good enough for a pre-filter
    const candidates = await dbInstances.parkingListing.findMany({
      where: {
        status: "ACTIVE",
        latitude: { gte: input.lat - boxDegrees, lte: input.lat + boxDegrees },
        longitude: { gte: input.lng - boxDegrees, lte: input.lng + boxDegrees },
      },
      include: { dealer: { select: { ownerName: true } } },
    });

    const results = await Promise.all(
      candidates.map(async (listing) => {
        const distance = distanceKm(input.lat, input.lng, listing.latitude, listing.longitude);
        const slotWindow = await findCoveringSlotWindow(
          listing.id,
          input.date,
          input.startHour,
          input.endHour,
        );
        const available = slotWindow
          ? slotWindow.capacity - slotWindow.booked - slotWindow.manualOccupiedCars - slotWindow.manualOccupiedBikes
          : 0;
        return {
          id: listing.id,
          name: listing.name,
          addressLine: listing.addressLine,
          city: listing.city,
          latitude: listing.latitude,
          longitude: listing.longitude,
          distanceKm: Math.round(distance * 10) / 10,
          hourlyRatePaise: listing.hourlyRatePaise,
          dailyRatePaise: listing.dailyRatePaise,
          photos: listing.photos,
          soldOut: available <= 0,
          waitlistAvailable: available <= 0,
          availableSpots: Math.max(available, 0),
        };
      }),
    );

    return results
      .filter((r) => r.distanceKm <= input.radiusKm)
      .sort((a, b) => {
        // Sold-out listings surface first (with a waitlist CTA), per the product spec —
        // then by distance within each group.
        if (a.soldOut !== b.soldOut) return a.soldOut ? -1 : 1;
        return a.distanceKm - b.distanceKm;
      });
  },

  async getListingDetail(listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({
      where: { id: listingId },
      include: { dealer: { select: { ownerName: true, phoneNumber: true } } },
    });
    if (!listing || listing.status === "REMOVED") {
      throw AppError.notFound("Listing not found");
    }
    return listing;
  },

  async getAvailability(listingId: string, date: Date) {
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const query = { where: { listingId, date: dayStart }, orderBy: { startHour: "asc" as const } };
    const windows = await dbInstances.parkingSlotWindow.findMany(query);
    await Promise.all(windows.map((w) => expireAbandonedBookingsForSlotWindow(w.id)));
    // Re-fetch so the response reflects any holds just expired above.
    const refreshed = await dbInstances.parkingSlotWindow.findMany(query);
    return refreshed.map((w) => ({
      id: w.id,
      startHour: w.startHour,
      endHour: w.endHour,
      capacity: w.capacity,
      available: Math.max(w.capacity - w.booked - w.manualOccupiedCars - w.manualOccupiedBikes, 0),
      manualOccupiedCars: w.manualOccupiedCars,
      manualOccupiedBikes: w.manualOccupiedBikes,
    }));
  },

  async createBooking(customerId: string, input: CreateBookingInput) {
    // Fast path: the same client tap retried after a network blip. Return the
    // original result instead of creating a second booking/reservation/order.
    if (input.idempotencyKey) {
      const existing = await dbInstances.parkingBooking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (existing.customerId !== customerId) {
          throw AppError.conflict("This idempotency key was already used by another request");
        }
        return { booking: existing, payment: await paymentsService.getCheckoutInfo(existing.orderId) };
      }
    }

    const listing = await dbInstances.parkingListing.findUnique({ where: { id: input.listingId } });
    if (!listing || listing.status !== "ACTIVE") {
      throw AppError.notFound("Listing not available");
    }

    const vehicle = await dbInstances.customerVehicle.findFirst({
      where: {
        id: input.vehicleId,
        isActive: true,
        OR: [{ customerId }, { accessList: { some: { customerId } } }],
      },
    });
    if (!vehicle) {
      throw AppError.notFound("Select a valid vehicle from your garage");
    }

    if (input.endTime.getTime() <= input.startTime.getTime()) {
      throw AppError.badRequest("End time must be after start time");
    }
    if (input.startTime.getTime() < Date.now()) {
      throw AppError.badRequest("Cannot book a slot in the past");
    }

    // A different idempotencyKey (e.g. the customer backed out and re-entered
    // the booking flow) shouldn't be able to reserve a second hold for the
    // exact same customer + listing + time window — return the existing one
    // instead of stacking a duplicate PENDING_PAYMENT/CONFIRMED booking.
    const existingForSameSlot = await dbInstances.parkingBooking.findFirst({
      where: {
        customerId,
        listingId: listing.id,
        startTime: input.startTime,
        endTime: input.endTime,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      },
    });
    if (existingForSameSlot) {
      if (existingForSameSlot.status === "CONFIRMED") {
        throw AppError.conflict("You've already booked this slot — check My Bookings to view it.");
      }
      return { booking: existingForSameSlot, payment: await paymentsService.getCheckoutInfo(existingForSameSlot.orderId) };
    }

    const istStartTime = toIstShifted(input.startTime);
    const istEndTime = toIstShifted(input.endTime);
    const startHour = istStartTime.getUTCHours();
    const endHour = istEndTime.getUTCHours() || 24;
    const slotWindow = await findCoveringSlotWindow(listing.id, istStartTime, startHour, endHour);
    if (!slotWindow) {
      throw AppError.notFound("No availability for this time window");
    }

    // Backstop for when the BullMQ sweep can't run (Redis down/unconfigured) —
    // clear this slot's own stale holds before deciding if it's actually full.
    await expireAbandonedBookingsForSlotWindow(slotWindow.id);

    const reserved = await reserveCapacity(slotWindow.id);
    if (!reserved) {
      throw AppError.conflict("This time slot just filled up");
    }

    const hours = hoursBetween(input.startTime, input.endTime);
    const amountPaise = hours * listing.hourlyRatePaise;

    let booking;
    try {
      booking = await dbInstances.parkingBooking.create({
        data: {
          customerId,
          listingId: listing.id,
          slotWindowId: slotWindow.id,
          vehicleId: input.vehicleId,
          startTime: input.startTime,
          endTime: input.endTime,
          amountPaise,
          status: "PENDING_PAYMENT",
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
    } catch (err) {
      // Slow path: a genuinely concurrent duplicate request lost the race on
      // the idempotencyKey unique constraint. Undo our own (redundant)
      // reservation and hand back the winner's booking instead of erroring.
      if (input.idempotencyKey && isUniqueConstraintOn(err, "idempotencyKey")) {
        await releaseCapacity(slotWindow.id);
        const winner = await dbInstances.parkingBooking.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (winner) {
          return { booking: winner, payment: await paymentsService.getCheckoutInfo(winner.orderId) };
        }
      } else if (isUniqueConstraintOnIndex(err, "ParkingBooking_active_slot_unique_idx")) {
        // Same idea, for the other race this function guards against: two
        // genuinely concurrent requests for the same customer+listing+time
        // both passed the earlier SELECT-based existingForSameSlot check
        // before either had committed. That partial unique index (see
        // schema.prisma's comment on ParkingBooking) is the real backstop —
        // whichever request loses this race gets the winner's booking back
        // instead of a raw 500.
        await releaseCapacity(slotWindow.id);
        const winner = await dbInstances.parkingBooking.findFirst({
          where: {
            customerId,
            listingId: listing.id,
            startTime: input.startTime,
            endTime: input.endTime,
            status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          },
        });
        if (winner) {
          if (winner.status === "CONFIRMED") {
            throw AppError.conflict("You've already booked this slot — check My Bookings to view it.");
          }
          return { booking: winner, payment: await paymentsService.getCheckoutInfo(winner.orderId) };
        }
      } else {
        // Any other failure — a pool timeout, a transient DB error, or simply
        // no idempotencyKey supplied at all (it's optional) — must not leave
        // the reservation above outstanding, or this slot silently loses one
        // unit of real capacity every time it happens.
        await releaseCapacity(slotWindow.id);
      }
      throw err;
    }

    try {
      const payment = await paymentsService.createOrder(customerId, {
        purpose: "PARKING_BOOKING",
        referenceId: booking.id,
        amountPaise,
      });
      await dbInstances.parkingBooking.update({
        where: { id: booking.id },
        data: { orderId: payment.orderId },
      });
      return { booking: { ...booking, orderId: payment.orderId }, payment };
    } catch (err) {
      // Payment order couldn't even be created — don't hold capacity for a booking
      // that has no way to be paid for.
      await releaseCapacity(slotWindow.id);
      await dbInstances.parkingBooking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      });
      throw err;
    }
  },

  async listMyBookings(customerId: string, pageInput?: PaginationInput) {
    const page = pageInput?.page ?? 1;
    const limit = pageInput?.limit ?? 20;
    const where = { customerId };
    const [bookings, total] = await Promise.all([
      dbInstances.parkingBooking.findMany({
        where,
        include: { listing: { select: { name: true, addressLine: true, city: true } } },
        // Ties on startTime happen whenever a first payment attempt is
        // abandoned and the customer retries for the same slot — createdAt
        // breaks the tie so the just-paid retry shows above the stale attempt.
        orderBy: [{ startTime: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.parkingBooking.count({ where }),
    ]);
    return { data: bookings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async cancelBooking(customerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: bookingId },
      include: { listing: { select: { dealerId: true } } },
    });
    if (!booking || booking.customerId !== customerId) {
      throw AppError.notFound("Booking not found");
    }
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw AppError.badRequest(`Booking is already ${booking.status.toLowerCase()}`);
    }
    if (booking.startTime.getTime() - Date.now() < CANCELLATION_WINDOW_MS) {
      throw AppError.badRequest("Too close to the booking start time to cancel");
    }

    const wasConfirmed = booking.status === "CONFIRMED";

    await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    await releaseCapacity(booking.slotWindowId);
    await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
    emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);

    if (wasConfirmed && booking.orderId) {
      await paymentsService.refund(booking.orderId, booking.amountPaise, "Customer cancelled booking");
    }

    return { ...booking, status: "CANCELLED" as const };
  },

  /** Checkout payload for an overstay charge — same shape createBooking's `payment` returns. */
  async getExtraPaymentInfo(customerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.customerId !== customerId) {
      throw AppError.notFound("Booking not found");
    }
    if (!booking.extraOrderId) {
      throw AppError.notFound("No overstay charge on this booking");
    }
    return paymentsService.getCheckoutInfo(booking.extraOrderId);
  },

  async joinWaitlist(customerId: string, input: JoinWaitlistInput) {
    const desiredDate = toDayStartUTC(input.desiredDate);
    return dbInstances.parkingWaitlistEntry.upsert({
      where: {
        listingId_customerId_desiredDate: {
          listingId: input.listingId,
          customerId,
          desiredDate,
        },
      },
      create: { listingId: input.listingId, customerId, desiredDate },
      update: {},
    });
  },

  /** Idempotent — leaving a waitlist you were never on (or already left) is a no-op, not an error. */
  async leaveWaitlist(customerId: string, input: LeaveWaitlistInput) {
    await dbInstances.parkingWaitlistEntry.deleteMany({
      where: { listingId: input.listingId, customerId, desiredDate: toDayStartUTC(input.desiredDate) },
    });
  },

  /**
   * BullMQ maintenance job — see jobs/workers.ts. Primary mechanism for
   * releasing holds abandoned before payment ever started; requires Redis.
   * expireAbandonedBookingsForSlotWindow (called inline from createBooking
   * and getAvailability below) is the backstop when Redis isn't configured.
   */
  async releaseAbandonedBookings() {
    const cutoff = new Date(Date.now() - ABANDONED_HOLD_MS);
    const abandoned = await dbInstances.parkingBooking.findMany({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
      include: { listing: { select: { dealerId: true } } },
    });
    for (const booking of abandoned) {
      try {
        await expireOneAbandonedBooking(booking);
      } catch (err) {
        logger.error({ err, bookingId: booking.id }, "Failed to release abandoned parking booking");
      }
    }
    if (abandoned.length > 0) {
      logger.info({ count: abandoned.length }, "Released abandoned parking booking holds");
    }
  },

  /**
   * BullMQ maintenance job — see jobs/workers.ts. Safety net for customers who
   * never show up: a dealer/employee can mark a booking no-show manually at
   * the gate (markBookingNoShow), but if nobody does, this releases the held
   * capacity on its own once the booking is well past its own end time.
   */
  async autoNoShowBookings() {
    const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MS);
    const noShows = await dbInstances.parkingBooking.findMany({
      where: { status: "CONFIRMED", actualCheckOutTime: null, checkedInAt: null, endTime: { lt: cutoff } },
      include: { listing: { select: { dealerId: true } } },
    });
    for (const booking of noShows) {
      try {
        await markOneBookingNoShow(booking);
      } catch (err) {
        logger.error({ err, bookingId: booking.id }, "Failed to auto no-show parking booking");
      }
    }
    if (noShows.length > 0) {
      logger.info({ count: noShows.length }, "Auto no-showed parking bookings");
    }
  },

  // ── Dealer-facing ────────────────────────────────────────────────

  async dealerLogin(input: DealerLoginInput) {
    const dealer = await dbInstances.parkingDealer.findUnique({
      where: { phoneNumber: input.phoneNumber },
    });
    if (!dealer || dealer.status === "SUSPENDED") {
      throw AppError.unauthorized("Invalid phone number or password");
    }
    const valid = await bcrypt.compare(input.password, dealer.passwordHash);
    if (!valid) {
      throw AppError.unauthorized("Invalid phone number or password");
    }
    const payload = { id: dealer.id, phoneNumber: dealer.phoneNumber };
    return {
      accessToken: signDealerAccess(payload),
      expiresIn: getDealerAccessExpirySeconds(),
      dealer: { id: dealer.id, ownerName: dealer.ownerName, status: dealer.status },
    };
  },

  // ── Admin-facing (Gupio ops onboarding a dealer — no dealer self-signup exists) ──

  async adminCreateDealer(input: AdminCreateDealerInput) {
    const existing = await dbInstances.parkingDealer.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (existing) {
      throw AppError.conflict("A dealer with this phone number already exists");
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return dbInstances.parkingDealer.create({
      data: {
        ownerName: input.ownerName,
        phoneNumber: input.phoneNumber,
        email: input.email,
        passwordHash,
        // An admin creating this account directly implies they've already vetted the dealer.
        status: "VERIFIED",
      },
      select: { id: true, ownerName: true, phoneNumber: true, email: true, status: true, createdAt: true },
    });
  },

  async adminListDealers() {
    return dbInstances.parkingDealer.findMany({
      select: {
        id: true,
        ownerName: true,
        phoneNumber: true,
        email: true,
        status: true,
        commissionRate: true,
        createdAt: true,
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async adminUpdateDealerCommission(dealerId: string, commissionRate: number) {
    if (commissionRate < 0 || commissionRate > 100) {
      throw AppError.badRequest("Commission rate must be between 0 and 100");
    }
    return dbInstances.parkingDealer.update({
      where: { id: dealerId },
      data: { commissionRate },
    });
  },

  async createListing(dealerId: string, input: CreateListingInput) {
    return dbInstances.parkingListing.create({ data: { ...input, dealerId } });
  },

  async updateListing(dealerId: string, listingId: string, input: UpdateListingInput) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    return dbInstances.parkingListing.update({ where: { id: listingId }, data: input });
  },

  async addListingPhotos(dealerId: string, listingId: string, files: Express.Multer.File[]) {
    if (files.length === 0) throw AppError.badRequest("No photos uploaded");
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    const uploaded = await Promise.all(files.map((file) => storageService.uploadFile(file, "parking", true)));
    const photos = [...listing.photos, ...uploaded.map((u) => u.url)];
    return dbInstances.parkingListing.update({ where: { id: listingId }, data: { photos } });
  },

  async listDealerListings(dealerId: string) {
    return dbInstances.parkingListing.findMany({ where: { dealerId }, orderBy: { createdAt: "desc" } });
  },

  async createSlotWindows(dealerId: string, listingId: string, input: CreateSlotWindowsInput) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    const capacity = Math.max(listing.fourWheelerCapacity, 1) + listing.twoWheelerCapacity;
    const rows: { listingId: string; date: Date; startHour: number; endHour: number; capacity: number }[] = [];
    for (
      let d = new Date(input.fromDate);
      d.getTime() <= input.toDate.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      rows.push({
        listingId,
        date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
        startHour: input.startHour,
        endHour: input.endHour,
        capacity: input.capacity ?? capacity,
      });
    }
    return dbInstances.parkingSlotWindow.createMany({ data: rows, skipDuplicates: true });
  },

  async listSlotWindows(dealerId: string, listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    return dbInstances.parkingSlotWindow.findMany({
      where: { listingId, date: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) } },
      orderBy: [{ date: "asc" }, { startHour: "asc" }],
    });
  },

  async findDealerSlotWindow(dealerId: string, listingId: string, slotWindowId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    const slotWindow = await dbInstances.parkingSlotWindow.findUnique({ where: { id: slotWindowId } });
    if (!slotWindow || slotWindow.listingId !== listingId) {
      throw AppError.notFound("Slot window not found");
    }
    return slotWindow;
  },

  /**
   * Dealer checks a walk-in (no app booking) into a bay right now, recording
   * which vehicle — not how much it'll cost, that depends on how long it
   * stays, so it's computed at checkOutWalkIn instead. `employeeId` is
   * passed through by the employee-facing wrapper below, undefined when the
   * dealer does this themselves.
   */
  async checkInWalkIn(
    dealerId: string,
    listingId: string,
    slotWindowId: string,
    input: CheckInWalkInInput,
    employeeId?: string,
  ) {
    await this.findDealerSlotWindow(dealerId, listingId, slotWindowId);
    const occupied = await occupyCapacityManually(slotWindowId, input.vehicleType);
    if (!occupied) {
      throw AppError.conflict("No free spots left in this time slot");
    }
    const walkIn = await dbInstances.parkingWalkIn.create({
      data: {
        listingId,
        slotWindowId,
        vehicleType: input.vehicleType,
        vehicleNumber: input.vehicleNumber,
        employeeId,
      },
    });
    emitParkingLiveUpdate(dealerId, listingId);
    return walkIn;
  },

  async findDealerWalkIn(dealerId: string, walkInId: string) {
    const walkIn = await dbInstances.parkingWalkIn.findUnique({ where: { id: walkInId } });
    if (!walkIn) throw AppError.notFound("Vehicle record not found");
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: walkIn.listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Vehicle record not found");
    }
    return { walkIn, listing };
  },

  /**
   * Dealer checks a walk-in vehicle out — frees the bay it was occupying,
   * charges for the actual time parked (same ceil-to-the-hour rule as app
   * bookings), and records how it was paid.
   */
  async checkOutWalkIn(dealerId: string, walkInId: string, paymentMethod: ParkingPaymentMethod) {
    const { walkIn, listing } = await this.findDealerWalkIn(dealerId, walkInId);
    if (walkIn.exitedAt) {
      throw AppError.badRequest("This vehicle has already checked out");
    }
    const exitedAt = new Date();
    const hours = hoursBetween(walkIn.enteredAt, exitedAt);
    const amountPaise = hours * listing.hourlyRatePaise;

    // Same atomic claim as checkoutBooking above: the WHERE re-checks
    // exitedAt is still null, so a dealer and an employee tapping checkout
    // on the same walk-in within milliseconds of each other can't both vacate
    // capacity and both create a Razorpay payment link for the same exit.
    const { count } = await dbInstances.parkingWalkIn.updateMany({
      where: { id: walkInId, exitedAt: null },
      data: { exitedAt, amountPaise, paymentMethod },
    });
    if (count === 0) {
      throw AppError.badRequest("This vehicle has already checked out");
    }

    // The bay is free the instant the exit is claimed above — same reasoning
    // as checkoutBooking's capacity release. This must not depend on the
    // (optional, external) payment link call below: if Razorpay throws, the
    // exit is already committed and exitedAt guards against retrying this
    // function, so failing to vacate here would leave the bay stuck
    // "occupied" with no way to free it.
    await vacateCapacityManually(walkIn.slotWindowId, walkIn.vehicleType);

    let paymentLinkData = undefined;
    if (paymentMethod === "ONLINE") {
      try {
        paymentLinkData = await paymentsService.createWalkInPaymentLink(walkInId, amountPaise);
      } catch (err) {
        logger.error({ err, walkInId }, "Failed to create walk-in payment link after checkout");
      }
    }

    const updated = await dbInstances.parkingWalkIn.findUniqueOrThrow({ where: { id: walkInId } });
    emitParkingLiveUpdate(dealerId, walkIn.listingId);
    return { ...updated, paymentLink: paymentLinkData };
  },

  /**
   * Everything currently parked at a listing right now — app bookings
   * (CONFIRMED, not yet checked out) merged with open walk-ins. The two are
   * fetched independently since ParkingBooking.vehicleId is a bare string,
   * not a Prisma relation (kept loose on purpose — see schema comment).
   */
  async getListingLiveStatus(listingId: string) {
    const [listing, bookings, walkIns] = await Promise.all([
      dbInstances.parkingListing.findUnique({
        where: { id: listingId },
        select: { hourlyRatePaise: true },
      }),
      dbInstances.parkingBooking.findMany({
        where: { listingId, status: "CONFIRMED", actualCheckOutTime: null },
        include: { customer: { select: { fullName: true, phoneNumber: true } } },
        orderBy: { startTime: "asc" },
      }),
      dbInstances.parkingWalkIn.findMany({
        where: { listingId, exitedAt: null },
        include: { employee: { select: { name: true } } },
        orderBy: { enteredAt: "asc" },
      }),
    ]);

    const hourlyRatePaise = listing?.hourlyRatePaise ?? 0;

    const vehicleIds = bookings.map((b) => b.vehicleId).filter((id): id is string => !!id);
    const vehicles = vehicleIds.length
      ? await dbInstances.customerVehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, registrationNumber: true },
        })
      : [];
    const registrationById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

    return {
      bookings: bookings.map((b) => ({
        id: b.id,
        source: "app" as const,
        vehicleNumber: b.vehicleId ? (registrationById.get(b.vehicleId) ?? null) : null,
        customerName: b.customer.fullName,
        customerPhone: b.customer.phoneNumber,
        amountPaise: b.amountPaise,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      walkIns: walkIns.map((w) => {
        const exitedAt = new Date();
        const hours = hoursBetween(w.enteredAt, exitedAt);
        const dynamicAmountPaise = hours * hourlyRatePaise;

        return {
          id: w.id,
          source: "walkin" as const,
          vehicleType: w.vehicleType,
          vehicleNumber: w.vehicleNumber,
          amountPaise: dynamicAmountPaise,
          paymentMethod: w.paymentMethod,
          employeeName: w.employee?.name ?? null,
          enteredAt: w.enteredAt,
        };
      }),
    };
  },

  async dealerGetListingLiveStatus(dealerId: string, listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    return this.getListingLiveStatus(listingId);
  },

  /** Most recent checked-out walk-ins for a listing — the audit trail once a vehicle leaves the live list. */
  async getListingWalkInHistory(listingId: string, pageInput?: PaginationInput) {
    const page = pageInput?.page ?? 1;
    const limit = pageInput?.limit ?? 20;
    const where = { listingId, exitedAt: { not: null } };
    const [walkIns, total] = await Promise.all([
      dbInstances.parkingWalkIn.findMany({
        where,
        include: { employee: { select: { name: true } } },
        orderBy: { exitedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.parkingWalkIn.count({ where }),
    ]);
    return {
      data: walkIns.map((w) => ({
        id: w.id,
        vehicleType: w.vehicleType,
        vehicleNumber: w.vehicleNumber,
        amountPaise: w.amountPaise,
        paymentMethod: w.paymentMethod,
        // CASH is confirmed the moment it's handed over; ONLINE only once the
        // payment.link.paid webhook actually fired. Revenue totals must key
        // off this, not raw paymentMethod presence — see checkOutWalkIn.
        paymentConfirmed: w.paymentMethod === "CASH" || !!w.onlinePaymentConfirmedAt,
        employeeName: w.employee?.name ?? null,
        enteredAt: w.enteredAt,
        exitedAt: w.exitedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async dealerGetListingWalkInHistory(dealerId: string, listingId: string, pageInput?: PaginationInput) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    return this.getListingWalkInHistory(listingId, pageInput);
  },

  /** Every one of the dealer's listings, with just the live counts — click through for detail. */
  async dealerListLiveListings(dealerId: string) {
    const listings = await dbInstances.parkingListing.findMany({ where: { dealerId }, select: { id: true, name: true } });
    const withCounts = await countLiveOccupancyByListing(listings);
    return withCounts.map((l) => ({
      listingId: l.id,
      listingName: l.name,
      appCount: l.appCount,
      walkInCount: l.walkInCount,
    }));
  },

  async listDealerBookings(dealerId: string, listInput?: BookingsListInput) {
    const page = listInput?.page ?? 1;
    const limit = listInput?.limit ?? 20;
    const scope = listInput?.scope ?? "active";
    const scopeWhere =
      scope === "active"
        ? { listing: { dealerId }, status: "CONFIRMED" as const, actualCheckOutTime: null }
        : {
            listing: { dealerId },
            OR: [{ status: { not: "CONFIRMED" as const } }, { actualCheckOutTime: { not: null } }],
          };
    const searchClauses = await buildBookingsSearchClauses(listInput);
    const where = searchClauses.length ? { AND: [scopeWhere, ...searchClauses] } : scopeWhere;

    const [bookings, total] = await Promise.all([
      dbInstances.parkingBooking.findMany({
        where,
        include: {
          listing: { select: { name: true } },
          customer: { select: { fullName: true, phoneNumber: true } },
        },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.parkingBooking.count({ where }),
    ]);

    const vehicleIds = bookings.map((b) => b.vehicleId).filter((id): id is string => !!id);
    const vehicles = vehicleIds.length
      ? await dbInstances.customerVehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, registrationNumber: true },
        })
      : [];
    const registrationById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

    return {
      data: bookings.map((b) => ({
        ...b,
        vehicleNumber: b.vehicleId ? (registrationById.get(b.vehicleId) ?? null) : null,
        customerName: b.customer.fullName,
        customerPhone: b.customer.phoneNumber,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Dealer/employee marks the actual moment a booked vehicle leaves. If that's
   * past the booked `endTime`, the overstay is charged as a separate order —
   * the original booking's payment already covered only the booked window.
   * Booking stays CONFIRMED (not COMPLETED) until that extra charge clears;
   * see the PARKING_EXTRA_CHARGE payment-event subscriber below.
   */
  async checkoutBooking(dealerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });
    if (!booking || booking.listing.dealerId !== dealerId) {
      throw AppError.notFound("Booking not found");
    }
    if (booking.status !== "CONFIRMED") {
      throw AppError.badRequest(`Booking is ${booking.status.toLowerCase()}, not confirmed`);
    }
    if (booking.actualCheckOutTime) {
      throw AppError.badRequest("Booking is already checked out");
    }

    const now = new Date();

    // Atomically claim this checkout: the WHERE clause re-checks the exact
    // same conditions just read above, so if two callers (e.g. a dealer and
    // an employee tapping checkout within milliseconds of each other) both
    // pass the guards above, only one of them actually flips a row here.
    // Every side effect below (capacity release, overstay order, customer
    // notification) only ever runs for whichever call actually won this
    // compare-and-swap — the previous plain `update` let both callers reach
    // every one of those side effects, including creating two separate
    // Razorpay orders for the same overstay.
    const { count } = await dbInstances.parkingBooking.updateMany({
      where: { id: bookingId, status: "CONFIRMED", actualCheckOutTime: null },
      data: { actualCheckOutTime: now },
    });
    if (count === 0) {
      throw AppError.badRequest("Booking is already checked out");
    }

    const overstayMs = now.getTime() - booking.endTime.getTime();

    // The vehicle is physically leaving right now regardless of overstay
    // payment status below — the bay is free the moment it drives out, not
    // whenever the extra charge (if any) eventually clears.
    await releaseCapacity(booking.slotWindowId);
    await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
    emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);

    if (overstayMs <= 0) {
      return dbInstances.parkingBooking.update({
        where: { id: booking.id },
        data: { status: "COMPLETED" },
      });
    }

    const extraHours = Math.ceil(overstayMs / (60 * 60 * 1000));
    const extraAmountPaise = extraHours * booking.listing.hourlyRatePaise;
    const payment = await paymentsService.createOrder(booking.customerId, {
      purpose: "PARKING_EXTRA_CHARGE",
      referenceId: booking.id,
      amountPaise: extraAmountPaise,
    });

    const updated = await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: {
        extraAmountPaise,
        extraOrderId: payment.orderId,
      },
    });

    await notificationService.notifyCustomer(booking.customerId, {
      title: "Extra parking charge",
      body: `You stayed ${extraHours}h longer than booked — pay ₹${(extraAmountPaise / 100).toFixed(0)} to complete checkout.`,
      type: "PARKING",
      link: `/parking/bookings/${booking.id}`,
      metadata: { bookingId: booking.id, extraOrderId: payment.orderId },
    });

    return updated;
  },

  /**
   * Dealer/employee marks a booked customer who never showed up — frees the
   * held slot immediately instead of waiting for autoNoShowBookings' sweep.
   * No refund: the slot was reserved for them for the whole booked window.
   */
  async markBookingNoShow(dealerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });
    if (!booking || booking.listing.dealerId !== dealerId) {
      throw AppError.notFound("Booking not found");
    }
    if (booking.status !== "CONFIRMED") {
      throw AppError.badRequest(`Booking is ${booking.status.toLowerCase()}, not confirmed`);
    }
    if (booking.checkedInAt) {
      throw AppError.badRequest("Customer already checked in — can't mark as no-show");
    }
    if (Date.now() - booking.startTime.getTime() < NO_SHOW_GRACE_MS) {
      throw AppError.badRequest("Too early to mark this booking no-show");
    }

    await markOneBookingNoShow(booking);
    return dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
  },

  /**
   * Dealer/employee override for a customer who arrives late, after the
   * gate already marked them NO_SHOW — no automatic partial-refund tiers,
   * just a manual reinstatement decision left to whoever's on the ground.
   * Re-claims capacity for the slot; if it's since filled up (another
   * booking or walk-in took it), the reinstatement fails rather than
   * silently overbooking the lot.
   */
  async undoBookingNoShow(dealerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });
    if (!booking || booking.listing.dealerId !== dealerId) {
      throw AppError.notFound("Booking not found");
    }
    if (booking.status !== "NO_SHOW") {
      throw AppError.badRequest(`Booking is ${booking.status.toLowerCase()}, not no-show`);
    }

    const reclaimed = await reserveCapacity(booking.slotWindowId);
    if (!reclaimed) {
      throw AppError.conflict("This slot has since been taken — can't reinstate the booking");
    }

    // Same compare-and-swap shape as the rest of this file's status
    // transitions — only the caller that actually wins this flip keeps the
    // capacity unit it just reserved above.
    const { count } = await dbInstances.parkingBooking.updateMany({
      where: { id: bookingId, status: "NO_SHOW" },
      data: { status: "CONFIRMED", checkedInAt: new Date() },
    });
    if (count === 0) {
      await releaseCapacity(booking.slotWindowId);
      throw AppError.badRequest(`Booking is ${booking.status.toLowerCase()}, not no-show`);
    }

    emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);
    await notificationService.notifyCustomer(booking.customerId, {
      title: "Parking booking reinstated",
      body: "Good news — your parking spot was reinstated after you checked in.",
      type: "PARKING",
      link: `/parking/bookings/${booking.id}`,
      metadata: { bookingId: booking.id },
    });
    return dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
  },

  /**
   * Dealer/employee marks that the booked customer's vehicle actually showed
   * up at the gate — the counterpart to markBookingNoShow. Purely a presence
   * signal: it doesn't change `status` (still CONFIRMED) or touch capacity,
   * it just takes the booking out of no-show eligibility (both the manual
   * button and the auto sweep check `checkedInAt` before acting).
   */
  async markBookingCheckedIn(dealerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });
    if (!booking || booking.listing.dealerId !== dealerId) {
      throw AppError.notFound("Booking not found");
    }
    if (booking.status !== "CONFIRMED") {
      throw AppError.badRequest(`Booking is ${booking.status.toLowerCase()}, not confirmed`);
    }
    if (booking.checkedInAt) {
      throw AppError.badRequest("Already marked as arrived");
    }

    const updated = await dbInstances.parkingBooking.update({
      where: { id: bookingId },
      data: { checkedInAt: new Date() },
    });
    emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);
    return updated;
  },

  // ── Dealer-facing: managing their own on-ground employees ───────

  /** Throws if any id in `listingIds` doesn't belong to `dealerId` — used before assigning employees to lots. */
  async assertListingsBelongToDealer(dealerId: string, listingIds: string[]): Promise<void> {
    if (listingIds.length === 0) return;
    const count = await dbInstances.parkingListing.count({ where: { id: { in: listingIds }, dealerId } });
    if (count !== listingIds.length) {
      throw AppError.badRequest("One or more selected lots don't belong to you");
    }
  },

  employeeWithListingsSelect: {
    id: true,
    name: true,
    phoneNumber: true,
    isActive: true,
    createdAt: true,
    assignedListings: { select: { listing: { select: { id: true, name: true } } } },
  } as const,

  formatEmployeeWithListings<T extends { assignedListings: { listing: { id: string; name: string } }[] }>(employee: T) {
    return { ...employee, assignedListings: employee.assignedListings.map((a) => a.listing) };
  },

  async createEmployee(dealerId: string, input: CreateEmployeeInput) {
    const existing = await dbInstances.parkingEmployee.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (existing) {
      throw AppError.conflict("An employee with this phone number already exists");
    }
    await this.assertListingsBelongToDealer(dealerId, input.listingIds);
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const employee = await dbInstances.parkingEmployee.create({
      data: {
        dealerId,
        name: input.name,
        phoneNumber: input.phoneNumber,
        passwordHash,
        assignedListings: { create: input.listingIds.map((listingId) => ({ listingId })) },
      },
      select: this.employeeWithListingsSelect,
    });
    return this.formatEmployeeWithListings(employee);
  },

  async listEmployees(dealerId: string) {
    const employees = await dbInstances.parkingEmployee.findMany({
      where: { dealerId },
      select: this.employeeWithListingsSelect,
      orderBy: { createdAt: "desc" },
    });
    return employees.map((e) => this.formatEmployeeWithListings(e));
  },

  async setEmployeeActive(dealerId: string, employeeId: string, isActive: boolean) {
    const employee = await dbInstances.parkingEmployee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.dealerId !== dealerId) {
      throw AppError.notFound("Employee not found");
    }
    const updated = await dbInstances.parkingEmployee.update({
      where: { id: employeeId },
      data: { isActive },
      select: this.employeeWithListingsSelect,
    });
    return this.formatEmployeeWithListings(updated);
  },

  /** Dealer reassigns which lot(s) an employee can see — replaces the full set. */
  async setEmployeeListings(dealerId: string, employeeId: string, listingIds: string[]) {
    const employee = await dbInstances.parkingEmployee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.dealerId !== dealerId) {
      throw AppError.notFound("Employee not found");
    }
    await this.assertListingsBelongToDealer(dealerId, listingIds);
    await dbInstances.parkingEmployeeListing.deleteMany({ where: { employeeId } });
    if (listingIds.length > 0) {
      await dbInstances.parkingEmployeeListing.createMany({
        data: listingIds.map((listingId) => ({ employeeId, listingId })),
      });
    }
    const updated = await dbInstances.parkingEmployee.findUniqueOrThrow({
      where: { id: employeeId },
      select: this.employeeWithListingsSelect,
    });
    return this.formatEmployeeWithListings(updated);
  },

  async resolveEmployeeListingIds(employeeId: string): Promise<string[]> {
    const rows = await dbInstances.parkingEmployeeListing.findMany({
      where: { employeeId },
      select: { listingId: true },
    });
    return rows.map((r) => r.listingId);
  },

  async assertEmployeeAssignedToListing(employeeId: string, listingId: string): Promise<void> {
    const count = await dbInstances.parkingEmployeeListing.count({ where: { employeeId, listingId } });
    if (count === 0) throw AppError.forbidden("You aren't assigned to this lot");
  },

  // ── Employee-facing (dealer's on-ground staff — read + occupy/vacate only) ──

  async employeeLogin(input: EmployeeLoginInput) {
    const employee = await dbInstances.parkingEmployee.findUnique({
      where: { phoneNumber: input.phoneNumber },
    });
    if (!employee || !employee.isActive) {
      throw AppError.unauthorized("Invalid phone number or password");
    }
    const valid = await bcrypt.compare(input.password, employee.passwordHash);
    if (!valid) {
      throw AppError.unauthorized("Invalid phone number or password");
    }
    const payload = { id: employee.id, phoneNumber: employee.phoneNumber };
    return {
      accessToken: signParkingEmployeeAccess(payload),
      expiresIn: getParkingEmployeeAccessExpirySeconds(),
      employee: { id: employee.id, name: employee.name },
    };
  },

  /** Resolves the employee's parent dealer, throwing if deactivated since the JWT was issued. */
  async resolveActiveEmployeeDealerId(employeeId: string): Promise<string> {
    const employee = await dbInstances.parkingEmployee.findUnique({ where: { id: employeeId } });
    if (!employee || !employee.isActive) {
      throw AppError.unauthorized("Employee account is no longer active");
    }
    return employee.dealerId;
  },

  /** Only the lot(s) this employee is assigned to — not everything the dealer owns. */
  async employeeListListings(employeeId: string) {
    const listingIds = await this.resolveEmployeeListingIds(employeeId);
    if (listingIds.length === 0) return [];
    return dbInstances.parkingListing.findMany({
      where: { id: { in: listingIds } },
      orderBy: { createdAt: "desc" },
    });
  },

  async employeeListSlotWindows(employeeId: string, listingId: string) {
    await this.assertEmployeeAssignedToListing(employeeId, listingId);
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    return this.listSlotWindows(dealerId, listingId);
  },

  async employeeCheckInWalkIn(employeeId: string, listingId: string, slotWindowId: string, input: CheckInWalkInInput) {
    await this.assertEmployeeAssignedToListing(employeeId, listingId);
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    return this.checkInWalkIn(dealerId, listingId, slotWindowId, input, employeeId);
  },

  async employeeCheckOutWalkIn(employeeId: string, walkInId: string, paymentMethod: ParkingPaymentMethod) {
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    const walkIn = await dbInstances.parkingWalkIn.findUnique({ where: { id: walkInId } });
    if (!walkIn) throw AppError.notFound("Vehicle record not found");
    await this.assertEmployeeAssignedToListing(employeeId, walkIn.listingId);
    return this.checkOutWalkIn(dealerId, walkInId, paymentMethod);
  },

  async employeeGetListingLiveStatus(employeeId: string, listingId: string) {
    await this.assertEmployeeAssignedToListing(employeeId, listingId);
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    return this.dealerGetListingLiveStatus(dealerId, listingId);
  },

  async employeeListLiveListings(employeeId: string) {
    const listingIds = await this.resolveEmployeeListingIds(employeeId);
    if (listingIds.length === 0) return [];
    const listings = await dbInstances.parkingListing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, name: true },
    });
    const withCounts = await countLiveOccupancyByListing(listings);
    return withCounts.map((l) => ({
      listingId: l.id,
      listingName: l.name,
      appCount: l.appCount,
      walkInCount: l.walkInCount,
    }));
  },

  async employeeGetListingWalkInHistory(employeeId: string, listingId: string, pageInput?: PaginationInput) {
    await this.assertEmployeeAssignedToListing(employeeId, listingId);
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    return this.dealerGetListingWalkInHistory(dealerId, listingId, pageInput);
  },

  async employeeCheckoutBooking(employeeId: string, bookingId: string) {
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw AppError.notFound("Booking not found");
    await this.assertEmployeeAssignedToListing(employeeId, booking.listingId);
    return this.checkoutBooking(dealerId, bookingId);
  },

  async employeeMarkBookingNoShow(employeeId: string, bookingId: string) {
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw AppError.notFound("Booking not found");
    await this.assertEmployeeAssignedToListing(employeeId, booking.listingId);
    return this.markBookingNoShow(dealerId, bookingId);
  },

  async employeeMarkBookingCheckedIn(employeeId: string, bookingId: string) {
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw AppError.notFound("Booking not found");
    await this.assertEmployeeAssignedToListing(employeeId, booking.listingId);
    return this.markBookingCheckedIn(dealerId, bookingId);
  },

  async employeeUndoBookingNoShow(employeeId: string, bookingId: string) {
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw AppError.notFound("Booking not found");
    await this.assertEmployeeAssignedToListing(employeeId, booking.listingId);
    return this.undoBookingNoShow(dealerId, bookingId);
  },

  async employeeListBookings(employeeId: string, listInput?: BookingsListInput) {
    const page = listInput?.page ?? 1;
    const limit = listInput?.limit ?? 20;
    const scope = listInput?.scope ?? "active";
    const listingIds = await this.resolveEmployeeListingIds(employeeId);
    if (listingIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
    const scopeWhere =
      scope === "active"
        ? { listingId: { in: listingIds }, status: "CONFIRMED" as const, actualCheckOutTime: null }
        : {
            listingId: { in: listingIds },
            OR: [{ status: { not: "CONFIRMED" as const } }, { actualCheckOutTime: { not: null } }],
          };
    const searchClauses = await buildBookingsSearchClauses(listInput);
    const where = searchClauses.length ? { AND: [scopeWhere, ...searchClauses] } : scopeWhere;

    const [bookings, total] = await Promise.all([
      dbInstances.parkingBooking.findMany({
        where,
        include: {
          listing: { select: { name: true } },
          customer: { select: { fullName: true, phoneNumber: true } },
        },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.parkingBooking.count({ where }),
    ]);

    const vehicleIds = bookings.map((b) => b.vehicleId).filter((id): id is string => !!id);
    const vehicles = vehicleIds.length
      ? await dbInstances.customerVehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, registrationNumber: true },
        })
      : [];
    const registrationById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

    return {
      data: bookings.map((b) => ({
        ...b,
        vehicleNumber: b.vehicleId ? (registrationById.get(b.vehicleId) ?? null) : null,
        customerName: b.customer.fullName,
        customerPhone: b.customer.phoneNumber,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};

// ── Admin-facing (Gupio ops — read-only visibility across every dealer) ──

export const parkingAdminLiveService = {
  async getListingLiveStatus(listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing) throw AppError.notFound("Listing not found");
    return parkingService.getListingLiveStatus(listingId);
  },

  async getListingWalkInHistory(listingId: string, pageInput?: PaginationInput) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing) throw AppError.notFound("Listing not found");
    return parkingService.getListingWalkInHistory(listingId, pageInput);
  },

  async listAllLiveListings(pageInput?: PaginationInput) {
    const page = pageInput?.page ?? 1;
    const limit = pageInput?.limit ?? 20;
    const [listings, total] = await Promise.all([
      dbInstances.parkingListing.findMany({
        include: { dealer: { select: { ownerName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.parkingListing.count(),
    ]);
    const withCounts = await countLiveOccupancyByListing(listings);
    return {
      data: withCounts.map((l) => ({
        listingId: l.id,
        listingName: l.name,
        city: l.city,
        dealerName: l.dealer.ownerName,
        appCount: l.appCount,
        walkInCount: l.walkInCount,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};

// ── Payment event subscriptions ──────────────────────────────────
// Registered once at module load. This is the only coupling between Payments
// and Parking — Payments never imports parking.service.ts directly.

paymentEvents.onSucceeded(async (event) => {
  if (event.purpose !== "PARKING_BOOKING") return;
  try {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: event.referenceId },
      include: { listing: { select: { dealerId: true, name: true, dealer: { select: { phoneNumber: true } } } } },
    });
    // The paid order must be THIS booking's own order — referenceId alone
    // isn't enough, since a customer can create a second, unrelated (and
    // arbitrarily cheap) order against the same referenceId via the generic
    // create-order endpoint. Confirming only on a match to booking.orderId
    // means paying that decoy order can never confirm a real booking.
    if (!booking || booking.status !== "PENDING_PAYMENT" || booking.orderId !== event.orderId) return;
    await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });
    // The one status-changing path in this file that used to never tell any
    // live-status screen it happened — a dealer had no way to see a booking
    // go PENDING_PAYMENT → CONFIRMED short of an unrelated refetch.
    emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);
    await notificationService.notifyCustomer(event.customerId, {
      title: "Parking booking confirmed",
      body: "Your payment cleared and your parking spot is confirmed.",
      type: "PARKING",
      link: `/parking/bookings/${booking.id}`,
      metadata: { bookingId: booking.id },
    });
    // Dealer awareness otherwise depended entirely on someone having the
    // live dashboard open in a browser tab — an SMS means a new booking
    // still reaches them if it isn't.
    try {
      if (booking.listing.dealer.phoneNumber) {
        await getSMSService().sendSMS(
          booking.listing.dealer.phoneNumber,
          `New online booking at ${booking.listing.name}: ${hoursBetween(booking.startTime, booking.endTime)}h from ${booking.startTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
        );
      }
    } catch (smsErr) {
      logger.error({ smsErr, bookingId: booking.id }, "Failed to SMS dealer about new parking booking");
    }
  } catch (err) {
    logger.error({ err, event }, "Failed to confirm parking booking after payment success");
  }
});

paymentEvents.onFailed(async (event) => {
  if (event.purpose !== "PARKING_BOOKING") return;
  try {
    const booking = await dbInstances.parkingBooking.findUnique({
      where: { id: event.referenceId },
      include: { listing: { select: { dealerId: true } } },
    });
    // Same orderId guard as the success handler above — otherwise anyone
    // could create a decoy order against another customer's PENDING_PAYMENT
    // booking's referenceId and let it fail, cancelling a booking they don't
    // own and releasing its capacity as a griefing vector.
    if (!booking || booking.status !== "PENDING_PAYMENT" || booking.orderId !== event.orderId) return;
    await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    await releaseCapacity(booking.slotWindowId);
    await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
    emitParkingLiveUpdate(booking.listing.dealerId, booking.listingId);
    await notificationService.notifyCustomer(event.customerId, {
      title: "Parking payment failed",
      body: "Your payment didn't go through, so the hold on your parking spot was released.",
      type: "PARKING",
      metadata: { bookingId: booking.id },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to release parking booking after payment failure");
  }
});

// The overstay charge is a second, independent order against the same
// booking (referenceId) — distinguished by `purpose` from the original
// PARKING_BOOKING order above. Success here is what finally marks a checked-
// out booking COMPLETED; a failure just leaves it CONFIRMED + checked-out so
// the customer can retry (see getExtraPaymentInfo).

paymentEvents.onSucceeded(async (event) => {
  if (event.purpose !== "PARKING_EXTRA_CHARGE") return;
  try {
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: event.referenceId } });
    // Same orderId guard as the PARKING_BOOKING handler above. This purpose
    // isn't reachable via the public create-order endpoint today (its zod
    // schema only allows PARKING_BOOKING/CAR_WASH_BOOKING), but this keeps
    // the handler correct on its own terms rather than relying on that.
    if (!booking || booking.status !== "CONFIRMED" || !booking.actualCheckOutTime || booking.extraOrderId !== event.orderId) return;
    await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: { status: "COMPLETED" },
    });
    await notificationService.notifyCustomer(event.customerId, {
      title: "Parking checkout complete",
      body: "Your overstay payment cleared — checkout is complete. Thanks for parking with us!",
      type: "PARKING",
      link: `/parking/bookings/${booking.id}`,
      metadata: { bookingId: booking.id },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to complete parking booking after overstay payment success");
  }
});

paymentEvents.onFailed(async (event) => {
  if (event.purpose !== "PARKING_EXTRA_CHARGE") return;
  try {
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: event.referenceId } });
    if (!booking) return;
    await notificationService.notifyCustomer(event.customerId, {
      title: "Overstay payment failed",
      body: "Your extra parking charge couldn't be processed — please retry from your booking.",
      type: "PARKING",
      link: `/parking/bookings/${booking.id}`,
      metadata: { bookingId: booking.id },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to notify customer after overstay payment failure");
  }
});

// A walk-in's QR-code payment actually clearing — this is the one place a
// live update on this event was missing entirely, so the dealer's QR modal
// had no way to learn the customer actually paid and never auto-closed it.
paymentEvents.onWalkInPaymentConfirmed(async (event) => {
  try {
    const walkIn = await dbInstances.parkingWalkIn.findUnique({
      where: { id: event.walkInId },
      include: { listing: { select: { dealerId: true } } },
    });
    if (!walkIn) return;
    emitParkingLiveUpdate(walkIn.listing.dealerId, walkIn.listingId);
  } catch (err) {
    logger.error({ err, event }, "Failed to emit live update after walk-in payment confirmed");
  }
});
