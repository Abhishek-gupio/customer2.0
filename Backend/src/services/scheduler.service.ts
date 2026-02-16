import cron from "node-cron";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { documentService } from "../modules/document/document.service";
import { expenseIntelligenceService } from "./expense-intelligence.service";
import { warrantyService } from "./warranty.service";

const db = dbInstances as any;

export const schedulerService = {
  init() {
    logger.info("Initializing Scheduler Service...");

    // ============================================================
    // 1. DAILY MAINTENANCE CHECK (Every day at 9:00 AM)
    // ============================================================
    cron.schedule("0 9 * * *", async () => {
      logger.info("Running Daily Maintenance Check...");
      try {
        // Get all active vehicles
        const vehicles = await db.customerVehicle.findMany({
          where: { isActive: true },
          select: { id: true, customerId: true },
        });

        logger.info(
          `Checking warranty alerts for ${vehicles.length} vehicles...`,
        );

        // 1. Warranty & Parts
        for (const vehicle of vehicles) {
          try {
            await warrantyService.checkAlerts(vehicle.id, vehicle.customerId);
          } catch (err) {
            logger.error(
              { err, vehicleId: vehicle.id },
              "Failed to check warranty alerts",
            );
          }
        }

        // 2. Document Expiry (RC, Insurance, PUC)
        logger.info("Checking document expiry alerts...");
        const activeCustomers = await db.customer.findMany({
          where: { isActive: true },
          select: { id: true },
        });

        for (const customer of activeCustomers) {
          try {
            const expiringDocs = await documentService.getExpiringDocuments(
              customer.id,
              30,
            ); // 30 days notice

            for (const doc of expiringDocs) {
              await db.inAppNotification.create({
                data: {
                  customerId: customer.id,
                  title: `${doc.type} Expiring Soon`, // e.g., "INSURANCE Expiring Soon"
                  body: `Your ${doc.type} (${doc.documentNumber}) is expiring on ${new Date(doc.expiryDate!).toLocaleDateString("en-IN")}. Renew now to avoid fines.`,
                  type: "WARNING",
                  link: `/documents/${doc.id}`,
                  metadata: { documentId: doc.id, expiryDate: doc.expiryDate },
                },
              });
            }
          } catch (err) {
            logger.error(
              { err, customerId: customer.id },
              "Failed to check document expiry",
            );
          }
        }

        logger.info("Daily Maintenance Check Completed.");
      } catch (err) {
        logger.error({ err }, "Daily Maintenance Check Failed");
      }
    });

    // ============================================================
    // 2. WEEKLY EXPENSE DIGEST (Every Monday at 10:00 AM)
    // ============================================================
    cron.schedule("0 10 * * 1", async () => {
      logger.info("Running Weekly Expense Digest...");
      try {
        // Get all active customers
        const customers = await db.customer.findMany({
          select: { id: true },
        });

        logger.info(
          `Generating weekly digests for ${customers.length} customers...`,
        );

        for (const customer of customers) {
          try {
            await expenseIntelligenceService.sendWeeklyDigestNotification(
              customer.id,
            );
          } catch (err) {
            logger.error(
              { err, customerId: customer.id },
              "Failed to send weekly digest",
            );
          }
        }
        logger.info("Weekly Expense Digest Completed.");
      } catch (err) {
        logger.error({ err }, "Weekly Expense Digest Failed");
      }
    });

    logger.info("Scheduler Service Initialized. Jobs Scheduled.");
  },
};
