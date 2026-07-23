import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/AppError";

export const settlementService = {
  /**
   * Generates settlements for all dealers for un-settled bookings/walk-ins up to the current date.
   * Typically triggered by a cron job in the evening.
   */
  async generateDailySettlements() {
    logger.info("Starting daily settlement generation...");

    // Find all dealers
    const dealers = await dbInstances.parkingDealer.findMany({
      select: { id: true, commissionRate: true },
    });

    const now = new Date();
    // Normalize date to midnight for the settlement record
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const results = [];

    for (const dealer of dealers) {
      try {
        const result = await this.generateDealerSettlement(dealer, date);
        if (result) results.push(result);
      } catch (err) {
        logger.error({ err, dealerId: dealer.id }, "Failed to generate settlement for dealer");
      }
    }

    logger.info({ totalGenerated: results.length }, "Completed daily settlement generation");
    return results;
  },

  async generateDealerSettlement(dealer: { id: string; commissionRate: number }, date: Date) {
    // We wrap this in a transaction so that we don't double settle if things fail midway
    return await dbInstances.$transaction(async (tx) => {
      // Base fare settles as soon as the vehicle has actually left
      // (actualCheckOutTime set) — that money was already collected when the
      // booking's original payment cleared (that's what got it to CONFIRMED
      // in the first place). It must not wait on a possible overstay charge,
      // which the customer might take days to pay, or never pay at all —
      // that used to leave the whole booking (base fare included) unsettled
      // forever whenever `status` stayed CONFIRMED instead of COMPLETED.
      const baseBookings = await tx.parkingBooking.findMany({
        where: {
          listing: { dealerId: dealer.id },
          actualCheckOutTime: { not: null },
          // A checked-out booking should only ever be CONFIRMED or COMPLETED,
          // but this must be explicit rather than relying on that holding
          // true elsewhere — paying a dealer for a booking that ends up
          // CANCELLED/refunded would be a real money leak, not just a
          // display glitch.
          status: { not: "CANCELLED" },
          isSettled: false,
        },
        select: { id: true, amountPaise: true },
      });

      // Overstay charge is tracked independently via extraSettled — it only
      // settles once it's actually been collected (status reaches COMPLETED
      // when the extra payment succeeds), which may land in a later day's
      // settlement run than the one that already settled the base fare.
      const extraBookings = await tx.parkingBooking.findMany({
        where: {
          listing: { dealerId: dealer.id },
          status: "COMPLETED",
          extraAmountPaise: { not: null },
          extraSettled: false,
        },
        select: { id: true, extraAmountPaise: true },
      });

      // Find unsettled completed walkins (exitedAt not null)
      const walkIns = await tx.parkingWalkIn.findMany({
        where: {
          listing: { dealerId: dealer.id },
          exitedAt: { not: null },
          isSettled: false,
        },
        select: { id: true, amountPaise: true },
      });

      if (baseBookings.length === 0 && extraBookings.length === 0 && walkIns.length === 0) {
        return null; // Nothing to settle
      }

      let totalCollected = 0;
      baseBookings.forEach((b) => {
        totalCollected += b.amountPaise;
      });
      extraBookings.forEach((b) => {
        totalCollected += b.extraAmountPaise || 0;
      });
      walkIns.forEach((w) => {
        totalCollected += w.amountPaise;
      });

      const gupioCommission = Math.floor((totalCollected * dealer.commissionRate) / 100);
      const amountSettled = totalCollected - gupioCommission;

      const settlement = await tx.parkingSettlement.create({
        data: {
          dealerId: dealer.id,
          date,
          totalCollected,
          gupioCommission,
          amountSettled,
          status: "PENDING", // PENDING actual transfer
        },
      });

      if (baseBookings.length > 0) {
        await tx.parkingBooking.updateMany({
          where: { id: { in: baseBookings.map((b) => b.id) } },
          data: { isSettled: true, settlementId: settlement.id },
        });
      }

      // Deliberately doesn't touch settlementId here: if a booking's base
      // fare was already settled under an earlier settlement record,
      // settlementId keeps pointing at that one — the `bookings` relation on
      // a ParkingSettlement therefore means "settlements that included this
      // booking's base fare," not a complete ledger of every settlement that
      // ever paid out something for it. The overstay contribution is still
      // correctly reflected in this settlement's own totalCollected/payout.
      if (extraBookings.length > 0) {
        await tx.parkingBooking.updateMany({
          where: { id: { in: extraBookings.map((b) => b.id) } },
          data: { extraSettled: true },
        });
      }

      if (walkIns.length > 0) {
        await tx.parkingWalkIn.updateMany({
          where: { id: { in: walkIns.map((w) => w.id) } },
          data: { isSettled: true, settlementId: settlement.id },
        });
      }

      return settlement;
    });
  },

  async listDealerSettlements(dealerId: string, pageInput?: { page?: number; limit?: number }) {
    const page = pageInput?.page ?? 1;
    const limit = pageInput?.limit ?? 20;
    const where = { dealerId };
    const [data, total] = await Promise.all([
      dbInstances.parkingSettlement.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.parkingSettlement.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
