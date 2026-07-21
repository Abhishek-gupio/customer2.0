import bcrypt from "bcryptjs";
import { dbInstances, type ParkingVehicleType, type ParkingPaymentMethod } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
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
  DealerLoginInput,
  CreateListingInput,
  UpdateListingInput,
  CreateSlotWindowsInput,
  AdminCreateDealerInput,
  CreateEmployeeInput,
  EmployeeLoginInput,
  CheckInWalkInInput,
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
function isUniqueConstraintOn(err: unknown, field: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code !== "P2002") return false;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const targets = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return targets.includes(field);
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

async function expireOneAbandonedBooking(booking: { id: string; slotWindowId: string; listingId: string; startTime: Date }): Promise<void> {
  await dbInstances.parkingBooking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });
  await releaseCapacity(booking.slotWindowId);
  await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
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
async function expireAbandonedBookingsForSlotWindow(slotWindowId: string): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONED_HOLD_MS);
  const abandoned = await dbInstances.parkingBooking.findMany({
    where: { slotWindowId, status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
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

    const startHour = input.startTime.getUTCHours();
    const endHour = input.endTime.getUTCHours() || 24;
    const slotWindow = await findCoveringSlotWindow(listing.id, input.startTime, startHour, endHour);
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

  async listMyBookings(customerId: string) {
    return dbInstances.parkingBooking.findMany({
      where: { customerId },
      include: { listing: { select: { name: true, addressLine: true, city: true } } },
      orderBy: { startTime: "desc" },
    });
  },

  async cancelBooking(customerId: string, bookingId: string) {
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
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
    return dbInstances.parkingWaitlistEntry.upsert({
      where: {
        listingId_customerId_desiredDate: {
          listingId: input.listingId,
          customerId,
          desiredDate: input.desiredDate,
        },
      },
      create: { listingId: input.listingId, customerId, desiredDate: input.desiredDate },
      update: {},
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

    let paymentLinkData = undefined;
    if (paymentMethod === "ONLINE") {
      paymentLinkData = await paymentsService.createWalkInPaymentLink(walkInId, amountPaise);
    }

    await vacateCapacityManually(walkIn.slotWindowId, walkIn.vehicleType);
    const updated = await dbInstances.parkingWalkIn.update({
      where: { id: walkInId },
      data: { exitedAt, amountPaise, paymentMethod },
    });
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
  async getListingWalkInHistory(listingId: string) {
    const walkIns = await dbInstances.parkingWalkIn.findMany({
      where: { listingId, exitedAt: { not: null } },
      include: { employee: { select: { name: true } } },
      orderBy: { exitedAt: "desc" },
      take: 100,
    });
    return walkIns.map((w) => ({
      id: w.id,
      vehicleType: w.vehicleType,
      vehicleNumber: w.vehicleNumber,
      amountPaise: w.amountPaise,
      paymentMethod: w.paymentMethod,
      employeeName: w.employee?.name ?? null,
      enteredAt: w.enteredAt,
      exitedAt: w.exitedAt,
    }));
  },

  async dealerGetListingWalkInHistory(dealerId: string, listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.dealerId !== dealerId) {
      throw AppError.notFound("Listing not found");
    }
    return this.getListingWalkInHistory(listingId);
  },

  /** Every one of the dealer's listings, with just the live counts — click through for detail. */
  async dealerListLiveListings(dealerId: string) {
    const listings = await dbInstances.parkingListing.findMany({ where: { dealerId } });
    return Promise.all(
      listings.map(async (l) => {
        const status = await this.getListingLiveStatus(l.id);
        return {
          listingId: l.id,
          listingName: l.name,
          appCount: status.bookings.length,
          walkInCount: status.walkIns.length,
        };
      }),
    );
  },

  async listDealerBookings(dealerId: string) {
    const bookings = await dbInstances.parkingBooking.findMany({
      where: { listing: { dealerId } },
      include: {
        listing: { select: { name: true } },
        customer: { select: { fullName: true, phoneNumber: true } },
      },
      orderBy: { startTime: "desc" },
    });

    const vehicleIds = bookings.map((b) => b.vehicleId).filter((id): id is string => !!id);
    const vehicles = vehicleIds.length
      ? await dbInstances.customerVehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, registrationNumber: true },
        })
      : [];
    const registrationById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

    return bookings.map((b) => ({
      ...b,
      vehicleNumber: b.vehicleId ? (registrationById.get(b.vehicleId) ?? null) : null,
      customerName: b.customer.fullName,
      customerPhone: b.customer.phoneNumber,
    }));
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
    const overstayMs = now.getTime() - booking.endTime.getTime();

    if (overstayMs <= 0) {
      return dbInstances.parkingBooking.update({
        where: { id: booking.id },
        data: { actualCheckOutTime: now, status: "COMPLETED" },
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
        actualCheckOutTime: now,
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
    const listings = await dbInstances.parkingListing.findMany({ where: { id: { in: listingIds } } });
    return Promise.all(
      listings.map(async (l) => {
        const status = await this.getListingLiveStatus(l.id);
        return {
          listingId: l.id,
          listingName: l.name,
          appCount: status.bookings.length,
          walkInCount: status.walkIns.length,
        };
      }),
    );
  },

  async employeeGetListingWalkInHistory(employeeId: string, listingId: string) {
    await this.assertEmployeeAssignedToListing(employeeId, listingId);
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    return this.dealerGetListingWalkInHistory(dealerId, listingId);
  },

  async employeeCheckoutBooking(employeeId: string, bookingId: string) {
    const dealerId = await this.resolveActiveEmployeeDealerId(employeeId);
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw AppError.notFound("Booking not found");
    await this.assertEmployeeAssignedToListing(employeeId, booking.listingId);
    return this.checkoutBooking(dealerId, bookingId);
  },

  async employeeListBookings(employeeId: string) {
    const listingIds = await this.resolveEmployeeListingIds(employeeId);
    if (listingIds.length === 0) return [];
    const bookings = await dbInstances.parkingBooking.findMany({
      where: { listingId: { in: listingIds } },
      include: {
        listing: { select: { name: true } },
        customer: { select: { fullName: true, phoneNumber: true } },
      },
      orderBy: { startTime: "desc" },
    });

    const vehicleIds = bookings.map((b) => b.vehicleId).filter((id): id is string => !!id);
    const vehicles = vehicleIds.length
      ? await dbInstances.customerVehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, registrationNumber: true },
        })
      : [];
    const registrationById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

    return bookings.map((b) => ({
      ...b,
      vehicleNumber: b.vehicleId ? (registrationById.get(b.vehicleId) ?? null) : null,
      customerName: b.customer.fullName,
      customerPhone: b.customer.phoneNumber,
    }));
  },
};

// ── Admin-facing (Gupio ops — read-only visibility across every dealer) ──

export const parkingAdminLiveService = {
  async getListingLiveStatus(listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing) throw AppError.notFound("Listing not found");
    return parkingService.getListingLiveStatus(listingId);
  },

  async getListingWalkInHistory(listingId: string) {
    const listing = await dbInstances.parkingListing.findUnique({ where: { id: listingId } });
    if (!listing) throw AppError.notFound("Listing not found");
    return parkingService.getListingWalkInHistory(listingId);
  },

  async listAllLiveListings() {
    const listings = await dbInstances.parkingListing.findMany({
      include: { dealer: { select: { ownerName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      listings.map(async (l) => {
        const status = await parkingService.getListingLiveStatus(l.id);
        return {
          listingId: l.id,
          listingName: l.name,
          city: l.city,
          dealerName: l.dealer.ownerName,
          appCount: status.bookings.length,
          walkInCount: status.walkIns.length,
        };
      }),
    );
  },
};

// ── Payment event subscriptions ──────────────────────────────────
// Registered once at module load. This is the only coupling between Payments
// and Parking — Payments never imports parking.service.ts directly.

paymentEvents.onSucceeded(async (event) => {
  if (event.purpose !== "PARKING_BOOKING") return;
  try {
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: event.referenceId } });
    if (!booking || booking.status !== "PENDING_PAYMENT") return;
    await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });
    await notificationService.notifyCustomer(event.customerId, {
      title: "Parking booking confirmed",
      body: "Your payment cleared and your parking spot is confirmed.",
      type: "PARKING",
      link: `/parking/bookings/${booking.id}`,
      metadata: { bookingId: booking.id },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to confirm parking booking after payment success");
  }
});

paymentEvents.onFailed(async (event) => {
  if (event.purpose !== "PARKING_BOOKING") return;
  try {
    const booking = await dbInstances.parkingBooking.findUnique({ where: { id: event.referenceId } });
    if (!booking || booking.status !== "PENDING_PAYMENT") return;
    await dbInstances.parkingBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    await releaseCapacity(booking.slotWindowId);
    await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
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
    if (!booking || booking.status !== "CONFIRMED" || !booking.actualCheckOutTime) return;
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
