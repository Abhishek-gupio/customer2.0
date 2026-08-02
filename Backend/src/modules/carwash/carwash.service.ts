import bcrypt from "bcryptjs";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { storageService } from "../../services/storage.service";
import { paymentEvents } from "../../services/payment-events";
import { paymentsService } from "../payments/payments.service";
import {
  signPartnerAccess,
  getPartnerAccessExpirySeconds,
  signTechnicianAccess,
  getTechnicianAccessExpirySeconds,
} from "./carwash.jwt";
import type {
  SearchCentersInput,
  CreateBookingInput,
  PartnerLoginInput,
  CreateTechnicianInput,
  CreateCenterInput,
  CreateSlotsInput,
  AdminCreatePartnerInput,
  TechnicianLoginInput,
} from "./carwash.validators";

const SALT_ROUNDS = 10;
/** Cancelling within this window of a scheduled visit-center slot is not allowed. */
const CANCELLATION_WINDOW_MS = 60 * 60 * 1000;
/** Doorstep jobs run 8am-8pm; slots generated within this window. */
const SLOT_DAY_START_HOUR = 8;
const SLOT_DAY_END_HOUR = 20;
/** A booking sitting in PENDING_PAYMENT this long with no payment activity releases its hold. */
const ABANDONED_HOLD_MS = 10 * 60 * 1000;

/** Base price per wash type, in paise. Doorstep adds a flat convenience surcharge. */
const WASH_TYPE_PRICE_PAISE: Record<string, number> = {
  EXTERIOR: 15000,
  INTERIOR: 20000,
  FOAM: 25000,
  PRESSURE: 20000,
  STEAM: 30000,
  WATERLESS: 18000,
  DETAILING: 150000,
  CERAMIC_COATING: 500000,
  WAX_POLISH: 80000,
  ENGINE_CLEAN: 40000,
  TYRE_POLISH: 15000,
  GLASS_TREATMENT: 20000,
  UNDERCARRIAGE: 25000,
  SANITIZATION: 15000,
  BIKE_WASH: 8000,
  EV_SAFE_WASH: 20000,
};
const DOORSTEP_SURCHARGE_PAISE = 10000;

/** Haversine distance in km — same approach as services/places.service.ts / parking.service.ts. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function priceFor(washType: string, serviceModel: string): number {
  const base = WASH_TYPE_PRICE_PAISE[washType];
  if (!base) throw AppError.badRequest("Unknown wash type");
  return serviceModel === "DOORSTEP" ? base + DOORSTEP_SURCHARGE_PAISE : base;
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
async function reserveSlotCapacity(slotId: string): Promise<boolean> {
  const result = await dbInstances.$queryRaw<{ id: string }[]>`
    UPDATE "customer"."WashSlot"
    SET "bookedCount" = "bookedCount" + 1
    WHERE "id" = ${slotId} AND "bookedCount" < "capacity"
    RETURNING "id"
  `;
  return result.length > 0;
}

async function releaseSlotCapacity(slotId: string): Promise<void> {
  await dbInstances.$executeRaw`
    UPDATE "customer"."WashSlot"
    SET "bookedCount" = GREATEST("bookedCount" - 1, 0)
    WHERE "id" = ${slotId}
  `;
}

async function expireOneAbandonedBooking(booking: { id: string; slotId: string | null }): Promise<void> {
  await dbInstances.washBooking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  if (booking.slotId) await releaseSlotCapacity(booking.slotId);
}

/**
 * Defense-in-depth: the BullMQ sweep is the primary mechanism, but does
 * nothing if Redis/BullMQ isn't configured. Calling this inline right before
 * reserving capacity means a stale hold gets cleared the moment anyone else
 * touches that slot, even if the background job never runs at all.
 */
async function expireAbandonedBookingsForSlot(slotId: string): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONED_HOLD_MS);
  const abandoned = await dbInstances.washBooking.findMany({
    where: { slotId, status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
  });
  for (const booking of abandoned) {
    try {
      await expireOneAbandonedBooking(booking);
    } catch (err) {
      logger.error({ err, bookingId: booking.id }, "Failed to lazily expire abandoned wash booking");
    }
  }
}

export const carwashService = {
  // ── Customer-facing ────────────────────────────────────────────

  async searchCenters(input: SearchCentersInput) {
    const boxDegrees = input.radiusKm / 111;
    const candidates = await dbInstances.washCenter.findMany({
      where: {
        isActive: true,
        latitude: { gte: input.lat - boxDegrees, lte: input.lat + boxDegrees },
        longitude: { gte: input.lng - boxDegrees, lte: input.lng + boxDegrees },
      },
      include: { partner: { select: { name: true, rating: true } } },
    });

    return candidates
      .map((center) => ({
        ...center,
        distanceKm: Math.round(distanceKm(input.lat, input.lng, center.latitude, center.longitude) * 10) / 10,
      }))
      .filter((c) => c.distanceKm <= input.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  },

  async getCenterDetail(centerId: string) {
    const center = await dbInstances.washCenter.findUnique({
      where: { id: centerId },
      include: { partner: { select: { name: true, rating: true } } },
    });
    if (!center || !center.isActive) throw AppError.notFound("Wash center not found");
    return center;
  },

  async getCenterSlots(centerId: string, date: Date) {
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const query = {
      where: { centerId, startsAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { startsAt: "asc" as const },
    };
    const slots = await dbInstances.washSlot.findMany(query);
    await Promise.all(slots.map((s) => expireAbandonedBookingsForSlot(s.id)));
    const refreshed = await dbInstances.washSlot.findMany(query);
    return refreshed.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      capacity: s.capacity,
      available: Math.max(s.capacity - s.bookedCount, 0),
    }));
  },

  async listPartners() {
    return dbInstances.washPartner.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, rating: true },
    });
  },

  async createBooking(customerId: string, input: CreateBookingInput) {
    // Fast path: the same client tap retried after a network blip.
    if (input.idempotencyKey) {
      const existing = await dbInstances.washBooking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.customerId !== customerId) {
          throw AppError.conflict("This idempotency key was already used by another request");
        }
        return { booking: existing, payment: await paymentsService.getCheckoutInfo(existing.orderId) };
      }
    }

    const amountPaise = priceFor(input.washType, input.serviceModel);
    let partnerId: string;
    let slotReserved = false;

    if (input.serviceModel === "VISIT_CENTER") {
      const center = await dbInstances.washCenter.findUnique({ where: { id: input.centerId! } });
      if (!center || !center.isActive) throw AppError.notFound("Wash center not available");
      const slot = await dbInstances.washSlot.findUnique({ where: { id: input.slotId! } });
      if (!slot || slot.centerId !== center.id) throw AppError.notFound("Slot not found for this center");

      await expireAbandonedBookingsForSlot(slot.id);
      const reserved = await reserveSlotCapacity(slot.id);
      if (!reserved) throw AppError.conflict("This slot just filled up — pick another");
      slotReserved = true;
      partnerId = center.partnerId;
    } else {
      const partner = await dbInstances.washPartner.findUnique({ where: { id: input.partnerId! } });
      if (!partner || partner.status !== "ACTIVE") throw AppError.notFound("Wash partner not available");
      partnerId = partner.id;

      if (input.latitude != null && input.longitude != null) {
        const activeCenters = await dbInstances.washCenter.findMany({
          where: { isActive: true },
          select: { latitude: true, longitude: true },
        });
        if (activeCenters.length > 0) {
          const minDistance = Math.min(
            ...activeCenters.map((c) => distanceKm(input.latitude!, input.longitude!, c.latitude, c.longitude))
          );
          if (minDistance > 10) {
            throw AppError.badRequest(
              `Doorstep wash is only available within 10 km of a wash center. Your location is ${minDistance.toFixed(1)} km away.`
            );
          }
        }
      }
    }

    let booking;
    try {
      booking = await dbInstances.washBooking.create({
        data: {
          customerId,
          vehicleId: input.vehicleId,
          partnerId,
          centerId: input.serviceModel === "VISIT_CENTER" ? input.centerId : null,
          slotId: input.serviceModel === "VISIT_CENTER" ? input.slotId : null,
          serviceModel: input.serviceModel,
          washType: input.washType,
          addressLine: input.addressLine,
          latitude: input.latitude,
          longitude: input.longitude,
          scheduledAt: input.scheduledAt,
          amountPaise,
          status: "PENDING_PAYMENT",
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
    } catch (err) {
      if (input.idempotencyKey && isUniqueConstraintOn(err, "idempotencyKey")) {
        if (slotReserved) await releaseSlotCapacity(input.slotId!);
        const winner = await dbInstances.washBooking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (winner) return { booking: winner, payment: await paymentsService.getCheckoutInfo(winner.orderId) };
      }
      throw err;
    }

    try {
      const payment = await paymentsService.createOrder(customerId, {
        purpose: "CAR_WASH_BOOKING",
        referenceId: booking.id,
        amountPaise,
      });
      await dbInstances.washBooking.update({ where: { id: booking.id }, data: { orderId: payment.orderId } });
      return { booking: { ...booking, orderId: payment.orderId }, payment };
    } catch (err) {
      if (slotReserved) await releaseSlotCapacity(input.slotId!);
      await dbInstances.washBooking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
      throw err;
    }
  },

  async listMyBookings(customerId: string) {
    return dbInstances.washBooking.findMany({
      where: { customerId },
      include: {
        center: { select: { name: true, address: true, latitude: true, longitude: true } },
        partner: { select: { name: true } },
        technician: { select: { name: true, phoneNumber: true, photoUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getBooking(customerId: string, bookingId: string) {
    const booking = await dbInstances.washBooking.findUnique({
      where: { id: bookingId },
      include: {
        center: { select: { name: true, address: true, latitude: true, longitude: true } },
        partner: { select: { name: true } },
        technician: { select: { name: true, phoneNumber: true, photoUrl: true } },
      },
    });
    if (!booking || booking.customerId !== customerId) throw AppError.notFound("Booking not found");
    return booking;
  },

  async cancelBooking(customerId: string, bookingId: string) {
    const booking = await dbInstances.washBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.customerId !== customerId) throw AppError.notFound("Booking not found");
    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw AppError.badRequest(`Booking is already ${booking.status.toLowerCase()}`);
    }
    if (booking.scheduledAt && booking.scheduledAt.getTime() - Date.now() < CANCELLATION_WINDOW_MS) {
      throw AppError.badRequest("Too close to the scheduled time to cancel");
    }

    const wasConfirmed = booking.status !== "PENDING_PAYMENT";

    await dbInstances.washBooking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    if (booking.slotId) await releaseSlotCapacity(booking.slotId);

    if (wasConfirmed && booking.orderId) {
      await paymentsService.refund(booking.orderId, booking.amountPaise, "Customer cancelled booking");
    }

    return { ...booking, status: "CANCELLED" as const };
  },

  /** BullMQ maintenance job — see jobs/workers.ts. */
  async releaseAbandonedBookings() {
    const cutoff = new Date(Date.now() - ABANDONED_HOLD_MS);
    const abandoned = await dbInstances.washBooking.findMany({
      where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    });
    for (const booking of abandoned) {
      try {
        await expireOneAbandonedBooking(booking);
      } catch (err) {
        logger.error({ err, bookingId: booking.id }, "Failed to release abandoned wash booking");
      }
    }
    if (abandoned.length > 0) {
      logger.info({ count: abandoned.length }, "Released abandoned wash booking holds");
    }
  },

  // ── Partner-facing ───────────────────────────────────────────────

  async partnerLogin(input: PartnerLoginInput) {
    const partner = await dbInstances.washPartner.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (!partner || partner.status === "SUSPENDED") {
      throw AppError.unauthorized("Invalid phone number or password");
    }
    const valid = await bcrypt.compare(input.password, partner.passwordHash);
    if (!valid) throw AppError.unauthorized("Invalid phone number or password");
    const payload = { id: partner.id, phoneNumber: partner.phoneNumber };
    return {
      accessToken: signPartnerAccess(payload),
      expiresIn: getPartnerAccessExpirySeconds(),
      partner: { id: partner.id, name: partner.name, status: partner.status },
    };
  },

  async createTechnician(partnerId: string, input: CreateTechnicianInput) {
    const existing = await dbInstances.washTechnician.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (existing) throw AppError.conflict("A technician with this phone number already exists");
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return dbInstances.washTechnician.create({
      data: { name: input.name, phoneNumber: input.phoneNumber, photoUrl: input.photoUrl, passwordHash, partnerId },
      select: { id: true, name: true, phoneNumber: true, photoUrl: true, isActive: true, rating: true, createdAt: true },
    });
  },

  async listTechnicians(partnerId: string) {
    return dbInstances.washTechnician.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" } });
  },

  async createCenter(partnerId: string, input: CreateCenterInput) {
    return dbInstances.washCenter.create({ data: { ...input, partnerId } });
  },

  async listPartnerCenters(partnerId: string) {
    return dbInstances.washCenter.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" } });
  },

  async createSlots(partnerId: string, centerId: string, input: CreateSlotsInput) {
    const center = await dbInstances.washCenter.findUnique({ where: { id: centerId } });
    if (!center || center.partnerId !== partnerId) throw AppError.notFound("Wash center not found");

    const rows: { centerId: string; startsAt: Date; endsAt: Date; capacity: number }[] = [];
    for (
      let d = new Date(Date.UTC(input.fromDate.getUTCFullYear(), input.fromDate.getUTCMonth(), input.fromDate.getUTCDate()));
      d.getTime() <= input.toDate.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      for (let hour = SLOT_DAY_START_HOUR; hour < SLOT_DAY_END_HOUR; hour += input.intervalHours) {
        const startsAt = new Date(d);
        startsAt.setUTCHours(hour, 0, 0, 0);
        const endsAt = new Date(startsAt.getTime() + input.intervalHours * 60 * 60 * 1000);
        rows.push({ centerId, startsAt, endsAt, capacity: input.capacity });
      }
    }
    return dbInstances.washSlot.createMany({ data: rows });
  },

  async listCenterSlots(partnerId: string, centerId: string) {
    const center = await dbInstances.washCenter.findUnique({ where: { id: centerId } });
    if (!center || center.partnerId !== partnerId) throw AppError.notFound("Wash center not found");
    return dbInstances.washSlot.findMany({
      where: { centerId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    });
  },

  async listPartnerJobs(partnerId: string) {
    return dbInstances.washBooking.findMany({
      where: { partnerId, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      include: {
        customer: { select: { fullName: true, phoneNumber: true } },
        technician: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async assignTechnician(partnerId: string, bookingId: string, technicianId: string) {
    const booking = await dbInstances.washBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.partnerId !== partnerId) throw AppError.notFound("Job not found");
    if (booking.status !== "CONFIRMED") throw AppError.badRequest(`Can't assign a technician to a ${booking.status.toLowerCase()} job`);
    const technician = await dbInstances.washTechnician.findUnique({ where: { id: technicianId } });
    if (!technician || technician.partnerId !== partnerId) throw AppError.notFound("Technician not found");

    return dbInstances.washBooking.update({
      where: { id: bookingId },
      data: { technicianId, status: "TECHNICIAN_ASSIGNED" },
    });
  },

  // ── Technician-facing ────────────────────────────────────────────
  // Field-work actions (photos, completion) are scoped to the technician
  // assigned to the job — least-privilege, not the partner's own login. See
  // docs/gupio-carwash-platform-plan.md §11.

  async technicianLogin(input: TechnicianLoginInput) {
    const technician = await dbInstances.washTechnician.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (!technician || !technician.isActive) {
      throw AppError.unauthorized("Invalid phone number or password");
    }
    const valid = await bcrypt.compare(input.password, technician.passwordHash);
    if (!valid) throw AppError.unauthorized("Invalid phone number or password");
    const payload = { id: technician.id, phoneNumber: technician.phoneNumber };
    return {
      accessToken: signTechnicianAccess(payload),
      expiresIn: getTechnicianAccessExpirySeconds(),
      technician: { id: technician.id, name: technician.name },
    };
  },

  async listMyTechnicianJobs(technicianId: string) {
    return dbInstances.washBooking.findMany({
      where: { technicianId, status: { in: ["TECHNICIAN_ASSIGNED", "IN_PROGRESS", "COMPLETED"] } },
      include: { customer: { select: { fullName: true, phoneNumber: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async uploadBeforePhotos(technicianId: string, bookingId: string, files: Express.Multer.File[]) {
    if (files.length === 0) throw AppError.badRequest("No photos uploaded");
    const booking = await dbInstances.washBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.technicianId !== technicianId) throw AppError.notFound("Job not found");
    if (booking.status !== "TECHNICIAN_ASSIGNED") {
      throw AppError.badRequest(`Can't start a ${booking.status.toLowerCase()} job`);
    }
    const uploaded = await Promise.all(files.map((f) => storageService.uploadFile(f, "carwash", true)));
    return dbInstances.washBooking.update({
      where: { id: bookingId },
      data: {
        beforePhotoUrls: [...booking.beforePhotoUrls, ...uploaded.map((u) => u.url)],
        status: "IN_PROGRESS",
      },
    });
  },

  async completeJob(technicianId: string, bookingId: string, files: Express.Multer.File[]) {
    const booking = await dbInstances.washBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.technicianId !== technicianId) throw AppError.notFound("Job not found");
    if (booking.status !== "IN_PROGRESS") {
      throw AppError.badRequest(`Can't complete a ${booking.status.toLowerCase()} job`);
    }
    const uploaded = await Promise.all(files.map((f) => storageService.uploadFile(f, "carwash", true)));
    const updated = await dbInstances.washBooking.update({
      where: { id: bookingId },
      data: {
        afterPhotoUrls: [...booking.afterPhotoUrls, ...uploaded.map((u) => u.url)],
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    void notificationService.notifyCustomer(booking.customerId, {
      title: "Your wash is complete",
      body: "Check the before/after photos and rate your experience.",
      type: "CAR_WASH",
      link: `/carwash/bookings/${bookingId}`,
      metadata: { bookingId },
    });

    return updated;
  },

  // ── Admin-facing (Gupio ops onboarding a wash partner) ──────────

  async adminCreatePartner(input: AdminCreatePartnerInput) {
    const existing = await dbInstances.washPartner.findUnique({ where: { phoneNumber: input.phoneNumber } });
    if (existing) throw AppError.conflict("A wash partner with this phone number already exists");
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return dbInstances.washPartner.create({
      data: { name: input.name, phoneNumber: input.phoneNumber, passwordHash, status: "ACTIVE" },
      select: { id: true, name: true, phoneNumber: true, status: true, createdAt: true },
    });
  },

  async adminListPartners() {
    return dbInstances.washPartner.findMany({
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
        rating: true,
        createdAt: true,
        _count: { select: { centers: true, technicians: true, bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};

// ── Payment event subscriptions ──────────────────────────────────
// Registered once at module load. This is the only coupling between Payments
// and Car Wash — Payments never imports carwash.service.ts directly.

paymentEvents.onSucceeded(async (event) => {
  if (event.purpose !== "CAR_WASH_BOOKING") return;
  try {
    const booking = await dbInstances.washBooking.findUnique({ where: { id: event.referenceId } });
    if (!booking || booking.status !== "PENDING_PAYMENT") return;
    await dbInstances.washBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
    await notificationService.notifyCustomer(event.customerId, {
      title: "Wash booking confirmed",
      body: "Your payment cleared and your wash is confirmed.",
      type: "CAR_WASH",
      link: `/carwash/bookings/${booking.id}`,
      metadata: { bookingId: booking.id },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to confirm wash booking after payment success");
  }
});

paymentEvents.onFailed(async (event) => {
  if (event.purpose !== "CAR_WASH_BOOKING") return;
  try {
    const booking = await dbInstances.washBooking.findUnique({ where: { id: event.referenceId } });
    if (!booking || booking.status !== "PENDING_PAYMENT") return;
    await dbInstances.washBooking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    if (booking.slotId) await releaseSlotCapacity(booking.slotId);
    await notificationService.notifyCustomer(event.customerId, {
      title: "Wash payment failed",
      body: "Your payment didn't go through, so the hold on your slot was released.",
      type: "CAR_WASH",
      metadata: { bookingId: booking.id },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to release wash booking after payment failure");
  }
});
