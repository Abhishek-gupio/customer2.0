import { Worker, Job } from "bullmq";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import {
  QUEUE_NAMES,
  defaultWorkerOptions,
  isQueueEnabled,
  JobData,
} from "../config/queue";
import { documentService } from "../modules/document/document.service";
import { expenseIntelligenceService } from "../services/expense-intelligence.service";
import { warrantyService } from "../services/warranty.service";
import { predictionService } from "../services/prediction.service";
import { telematicsService } from "../services/telematics.service";

const db = dbInstances as any;

/**
 * WORKER: Maintenance & Alerts
 * Handles: Daily Warranty Checks, Document Expiry, Telematics Sync
 */
export const maintenanceWorker = new Worker<JobData>(
  QUEUE_NAMES.MAINTENANCE,
  async (job: Job) => {
    logger.info(
      `[MaintenanceWorker] Processing job ${job.name} (ID: ${job.id})`,
    );

    try {
      if (job.name === "daily-maintenance") {
        await runDailyMaintenance();
      } else if (job.name === "sync-telematics") {
        await telematicsService.syncTripsForAllDevices();
      }
    } catch (err) {
      logger.error({ err, jobId: job.id }, "[MaintenanceWorker] Job failed");
      throw err;
    }
  },
  defaultWorkerOptions,
);

/**
 * WORKER: Notifications & Digests
 * Handles: Weekly Expense Digest, Marketing Emails
 */
export const notificationWorker = new Worker<JobData>(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job: Job) => {
    logger.info(
      `[NotificationWorker] Processing job ${job.name} (ID: ${job.id})`,
    );

    try {
      if (job.name === "weekly-digest") {
        await runWeeklyDigest();
      }
    } catch (err) {
      logger.error({ err, jobId: job.id }, "[NotificationWorker] Job failed");
      throw err;
    }
  },
  defaultWorkerOptions,
);

/**
 * WORKER: Health Score & Analytics
 * Handles: Vehicle Health Score updates
 */
export const healthScoreWorker = new Worker<JobData>(
  QUEUE_NAMES.HEALTH_SCORE,
  async (job: Job) => {
    logger.info(
      `[HealthScoreWorker] Processing job ${job.name} (ID: ${job.id})`,
    );

    try {
      if (job.name === "update-health-scores") {
        await runHealthScoreUpdate();
      }
    } catch (err) {
      logger.error({ err, jobId: job.id }, "[HealthScoreWorker] Job failed");
      throw err;
    }
  },
  defaultWorkerOptions,
);

// ============================================================================
// JOB HANDLERS (Migrated from Scheduler Service)
// ============================================================================

// 1. Daily Maintenance (Warranty + Docs)
async function runDailyMaintenance() {
  logger.info("Running Daily Maintenance Check...");

  const vehicles = await db.customerVehicle.findMany({
    where: { isActive: true },
    select: { id: true, customerId: true },
  });

  for (const vehicle of vehicles) {
    try {
      await warrantyService.checkAlerts(vehicle.id, vehicle.customerId);
    } catch (err) {
      logger.error({ err, vehicleId: vehicle.id }, "Warranty check failed");
    }
  }

  const customers = await db.customer.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const customer of customers) {
    try {
      const expiringDocs = await documentService.getExpiringDocuments(
        customer.id,
        30,
      );
      for (const doc of expiringDocs) {
        await db.inAppNotification.create({
          data: {
            customerId: customer.id,
            title: `${doc.type} Expiring Soon`,
            body: `Your ${doc.type} (${doc.documentNumber}) is expiring on ${new Date(doc.expiryDate!).toLocaleDateString("en-IN")}.`,
            type: "WARNING",
            link: `/documents/${doc.id}`,
            metadata: { documentId: doc.id, expiryDate: doc.expiryDate },
          },
        });
      }
    } catch (err) {
      logger.error({ err, customerId: customer.id }, "Doc expiry check failed");
    }
  }
}

// 2. Weekly Expense Digest
async function runWeeklyDigest() {
  logger.info("Running Weekly Expense Digest...");
  const customers = await db.customer.findMany({ select: { id: true } });

  for (const customer of customers) {
    try {
      await expenseIntelligenceService.sendWeeklyDigestNotification(
        customer.id,
      );
    } catch (err) {
      logger.error({ err, customerId: customer.id }, "Weekly digest failed");
    }
  }
}

// 3. Weekly Health Score Update
async function runHealthScoreUpdate() {
  logger.info("Running Weekly Health Score Update...");
  const vehicles = await db.customerVehicle.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const vehicle of vehicles) {
    try {
      await predictionService.calculateAdvancedHealthScore(vehicle.id);
    } catch (err) {
      logger.error({ err, vehicleId: vehicle.id }, "Health score update failed");
    }
  }
}

// Initialize workers lazily so local dev without Redis does not try localhost:6379.
export const initWorkers = () => {
  if (!isQueueEnabled || !defaultWorkerOptions) {
    logger.info("BullMQ workers disabled (REDIS_URL not set)");
    return;
  }
  if (workersInitialized) return;

  const maintenanceWorker = new Worker<JobData>(
    QUEUE_NAMES.MAINTENANCE,
    async (job: Job) => {
      logger.info(
        `[MaintenanceWorker] Processing job ${job.name} (ID: ${job.id})`,
      );
      if (job.name === "daily-maintenance") {
        await runDailyMaintenance();
      }
    },
    defaultWorkerOptions,
  );

  const notificationWorker = new Worker<JobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job) => {
      logger.info(
        `[NotificationWorker] Processing job ${job.name} (ID: ${job.id})`,
      );
      if (job.name === "weekly-digest") {
        await runWeeklyDigest();
      }
    },
    defaultWorkerOptions,
  );

  const healthScoreWorker = new Worker<JobData>(
    QUEUE_NAMES.HEALTH_SCORE,
    async (job: Job) => {
      logger.info(
        `[HealthScoreWorker] Processing job ${job.name} (ID: ${job.id})`,
      );
      if (job.name === "update-health-scores") {
        await runHealthScoreUpdate();
      }
    },
    defaultWorkerOptions,
  );

  maintenanceWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Maintenance Job Failed");
  });
  notificationWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Notification Job Failed");
  });
  healthScoreWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Health Score Job Failed");
  });

  workersInitialized = true;
  logger.info("Background Workers Initialized");
};
