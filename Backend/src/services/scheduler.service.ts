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
      logger.warn(
        "BullMQ scheduler disabled (REDIS_URL not set) — abandoned parking-booking holds will only be " +
          "cleared lazily (on the next search/booking touching that slot), not swept proactively every 5 min.",
      );
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

    const enableBullmqTelematicsSync =
      String(process.env.TELEMATICS_SYNC_BULLMQ_ENABLED).toLowerCase() === "true";

    if (!enableBullmqTelematicsSync) {
      // Ensure any previously scheduled repeatable job is removed so it doesn't keep firing.
      const repeatable = await queues.maintenance.getRepeatableJobs();
      for (const job of repeatable) {
        if (job.name === "sync-telematics") {
          await queues.maintenance.removeRepeatableByKey(job.key);
          logger.info({ key: job.key }, "Removed sync-telematics repeatable job (bullmq disabled)");
        }
      }
      logger.info("Telematics BullMQ periodic sync disabled by default");
    } else {
      // A2. Telematics Sync (Every 60 min — single job; duplicates removed to avoid double login / rate limit)
      const repeatable = await queues.maintenance.getRepeatableJobs();
      for (const job of repeatable) {
        if (job.name === "sync-telematics") {
          await queues.maintenance.removeRepeatableByKey(job.key);
          logger.info({ key: job.key }, "Removed duplicate sync-telematics repeatable job");
        }
      }
      await queues.maintenance.add(
        "sync-telematics",
        {},
        {
          repeat: { pattern: "0 * * * *" },
          jobId: "sync-telematics-job",
        },
      );
      logger.info("Scheduled: Telematics Sync (0 * * * * — hourly)");
    }

    // A3. Daily Scraper (Fuel, News, Content at 6:30 AM)
    await queues.maintenance.add(
      "daily-scraping",
      {},
      {
        repeat: { pattern: "30 6 * * *" },
        jobId: "daily-scraping-job",
      },
    );
    logger.info("Scheduled: Daily Scraping (30 6 * * *)");

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

    // E. Release abandoned parking booking holds (Every 5 min)
    await queues.maintenance.add(
      "release-abandoned-parking-bookings",
      {},
      {
        repeat: { pattern: "*/5 * * * *" },
        jobId: "release-abandoned-parking-bookings-job",
      },
    );
    logger.info("Scheduled: Release Abandoned Parking Bookings (*/5 * * * *)");

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

  /**
   * Graceful Shutdown
   */
  async shutdown() {
    if (!queues) return;
    logger.info("Closing BullMQ queues...");
    await Promise.all(Object.values(queues).map((q) => q.close()));
  },
};
