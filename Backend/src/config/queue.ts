import { Queue, QueueOptions, WorkerOptions } from "bullmq";
import { env } from "./env";
import { logger } from "./logger";

const redisUrl = env.REDIS_URL;
const allowQueuesInDev = env.NODE_ENV !== "development";
let redisConfig:
  | {
      host: string;
      port: number;
      password?: string;
      maxRetriesPerRequest: null;
    }
  | null = null;

if (redisUrl) {
  try {
    const parsed = new URL(redisUrl);
    redisConfig = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    logger.warn("Invalid REDIS_URL; BullMQ scheduler/workers disabled");
    redisConfig = null;
  }
}

export const isQueueEnabled = redisConfig !== null && allowQueuesInDev;

if (redisConfig && !allowQueuesInDev) {
  logger.info("BullMQ queues disabled in development; Redis-backed background jobs are skipped.");
}

// Queue Definitions
export const QUEUE_NAMES = {
  MAINTENANCE: "maintenance-queue",
  NOTIFICATIONS: "notifications-queue", // For emails, digests, push notifs
  HEALTH_SCORE: "health-score-queue",
  DATA_PROCESSING: "data-processing-queue", // For heavy analytics, OCR post-processing
  EXPENSE_INGESTION: "expense-ingestion-queue", // AI ingestion for RAG
  BUDGET_CHECK: "budget-check-queue", // Real-time budget alerts
} as const;

// Queue Options
const defaultQueueOptions: QueueOptions = {
  connection: redisConfig!,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // Slightly longer backoff for external API calls
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Create Queues
export const queues = isQueueEnabled
  ? {
      maintenance: new Queue(QUEUE_NAMES.MAINTENANCE, defaultQueueOptions),
      notifications: new Queue(QUEUE_NAMES.NOTIFICATIONS, defaultQueueOptions),
      healthScore: new Queue(QUEUE_NAMES.HEALTH_SCORE, defaultQueueOptions),
      dataProcessing: new Queue(
        QUEUE_NAMES.DATA_PROCESSING,
        defaultQueueOptions,
      ),
      expenseIngestion: new Queue(
        QUEUE_NAMES.EXPENSE_INGESTION,
        defaultQueueOptions,
      ),
      budgetCheck: new Queue(
        QUEUE_NAMES.BUDGET_CHECK,
        defaultQueueOptions,
      ),
    }
  : null;

// Worker Options
export const defaultWorkerOptions: WorkerOptions | null = isQueueEnabled
  ? {
      connection: redisConfig!,
      concurrency: 5, // Process 5 jobs at once per worker
    }
  : null;

// Type definition for Job Data
export interface JobData {
  customerId?: string;
  vehicleId?: string;
  type?: string;
  metadata?: any;
}
