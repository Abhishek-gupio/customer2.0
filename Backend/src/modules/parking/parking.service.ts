import bcrypt from "bcryptjs";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { paymentEvents } from "../../services/payment-events";
import { paymentsService } from "../payments/payments.service";
import { signDealerAccess, getDealerAccessExpirySeconds } from "./parking.jwt";
import type {
  SearchListingsInput,
  CreateBookingInput,
  JoinWaitlistInput,
  DealerLoginInput,
  CreateListingInput,
  UpdateListingInput,
  CreateSlotWindowsInput,
} from "./parking.validators";

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
        const available = slotWindow ? slotWindow.capacity - slotWindow.booked : 0;
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
    const windows = await dbInstances.parkingSlotWindow.findMany({
      where: { listingId, date: dayStart },
      orderBy: { startHour: "asc" },
    });
    return windows.map((w) => ({
      id: w.id,
      startHour: w.startHour,
      endHour: w.endHour,
      capacity: w.capacity,
      available: Math.max(w.capacity - w.booked, 0),
    }));
  },

  async createBooking(customerId: string, input: CreateBookingInput) {
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

    const reserved = await reserveCapacity(slotWindow.id);
    if (!reserved) {
      throw AppError.conflict("This time slot just filled up");
    }

    const hours = hoursBetween(input.startTime, input.endTime);
    const amountPaise = hours * listing.hourlyRatePaise;

    const booking = await dbInstances.parkingBooking.create({
      data: {
        customerId,
        listingId: listing.id,
        slotWindowId: slotWindow.id,
        vehicleId: input.vehicleId,
        startTime: input.startTime,
        endTime: input.endTime,
        amountPaise,
        status: "PENDING_PAYMENT",
      },
    });

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

  /** BullMQ maintenance job — see jobs/workers.ts. Releases holds abandoned before payment ever started. */
  async releaseAbandonedBookings() {
    const cutoff = new Date(Date.now() - ABANDONED_HOLD_MS);
    const abandoned = await dbInstances.parkingBooking.findMany({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    });
    for (const booking of abandoned) {
      try {
        await dbInstances.parkingBooking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        });
        await releaseCapacity(booking.slotWindowId);
        await notifyWaitlistForFreedCapacity(booking.listingId, booking.startTime);
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

  async listDealerBookings(dealerId: string) {
    return dbInstances.parkingBooking.findMany({
      where: { listing: { dealerId } },
      include: { listing: { select: { name: true } } },
      orderBy: { startTime: "desc" },
    });
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
