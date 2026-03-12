import { isQueueEnabled, queues } from "../config/queue";
import { logger } from "../config/logger";
import { initWorkers } from "../jobs/workers";

export const schedulerService = {
  /**
   * Initialize BullMQ Schedulers and Workers
   * This replaces the old node-cron setup.
   */
  async init() {
    if (!isQueueEnabled || !queues) {
      logger.info("BullMQ scheduler disabled (REDIS_URL not set)");
      return;
    }
    logger.info("Initializing BullMQ Scheduler Service...");

    // 1. Start Workers
    initWorkers();

    // 2. Schedule Repeatable Jobs
    // IMPORTANT: 'repeat' options act like cron jobs.
    // BullMQ ensures these are unique (if jobId/name matches).

    // A. Daily Maintenance (Every day at 9:00 AM)
    await queues.maintenance.add(
      "daily-maintenance",
      {},
      {
        repeat: { pattern: "0 9 * * *" },
        jobId: "daily-maintenance-job", // fixed ID ensures singleton
      },
    );
    logger.info("Scheduled: Daily Maintenance (0 9 * * *)");

    // A2. Telematics Sync (Every 10 minutes)
    await queues.maintenance.add(
      "sync-telematics",
      {},
      {
        repeat: { pattern: "*/10 * * * *" },
        jobId: "sync-telematics-job",
      },
    );
    logger.info("Scheduled: Telematics Sync (*/10 * * * *)");

    // B. Weekly Expense Digest (Every Monday at 10:00 AM)
    await queues.notifications.add(
      "weekly-digest",
      {},
      {
        repeat: { pattern: "0 10 * * 1" },
        jobId: "weekly-digest-job",
      },
    );
    logger.info("Scheduled: Weekly Expense Digest (0 10 * * 1)");

    // C. Weekly Health Score Update (Every Monday at 2:00 AM)
    await queues.healthScore.add(
      "update-health-scores",
      {},
      {
        repeat: { pattern: "0 2 * * 1" },
        jobId: "health-score-update-job",
      },
    );
    logger.info("Scheduled: Weekly Health Score Update (0 2 * * 1)");

    // D. Proactive AI Chat Check (Every day at 8:00 AM)
    await queues.maintenance.add(
      "proactive-ai-check",
      {},
      {
        repeat: { pattern: "0 8 * * *" },
        jobId: "proactive-ai-check-job",
      },
    );
    logger.info("Scheduled: Proactive AI Check (0 8 * * *)");

    logger.info("Scheduler Service Initialized with BullMQ 🐂");
  },

  /**
   * Ad-hoc Job Scheduling Helpers
   */
  async scheduleHealthCheck(vehicleId: string) {
    if (!queues) return;
    // Add a one-off job
    await queues.healthScore.add("update-health-scores-single", { vehicleId });
  },

  async scheduleNotification(customerId: string, type: string, payload: any) {
    if (!queues) return;
    await queues.notifications.add("send-notification", {
      customerId,
      type,
      payload,
    });
  },
};
