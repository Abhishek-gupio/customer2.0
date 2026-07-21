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
      // Find unsettled completed bookings
      const bookings = await tx.parkingBooking.findMany({
        where: {
          listing: { dealerId: dealer.id },
          status: "COMPLETED",
          isSettled: false,
        },
        select: { id: true, amountPaise: true, extraAmountPaise: true },
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

      if (bookings.length === 0 && walkIns.length === 0) {
        return null; // Nothing to settle
      }

      let totalCollected = 0;
      bookings.forEach((b) => {
        totalCollected += b.amountPaise + (b.extraAmountPaise || 0);
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

      // Mark bookings and walk-ins as settled
      if (bookings.length > 0) {
        await tx.parkingBooking.updateMany({
          where: { id: { in: bookings.map((b) => b.id) } },
          data: { isSettled: true, settlementId: settlement.id },
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
  }
};
