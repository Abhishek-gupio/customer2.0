import { Queue, Worker, QueueOptions, WorkerOptions, Job } from "bullmq";
import { env } from "./env";
import { logger } from "./logger";
import Redis from "ioredis";

// Shared Redis connection for BullMQ
// BullMQ needs 3 connections: one for client, one for subscriber, one for blocking commands
// We will let BullMQ manage its own connections but provide the shared Redis config

const redisConfig = {
  host: env.REDIS_URL ? new URL(env.REDIS_URL).hostname : "localhost",
  port: env.REDIS_URL ? Number(new URL(env.REDIS_URL).port) : 6379,
  password: env.REDIS_URL ? new URL(env.REDIS_URL).password : undefined,
  maxRetriesPerRequest: null, // Critical: BullMQ requires this to be null
};

// Queue Definitions
export const QUEUE_NAMES = {
  MAINTENANCE: "maintenance-queue",
  NOTIFICATIONS: "notifications-queue", // For emails, digests, push notifs
  HEALTH_SCORE: "health-score-queue",
  DATA_PROCESSING: "data-processing-queue", // For heavy analytics, OCR post-processing
} as const;

// Queue Options
const defaultQueueOptions: QueueOptions = {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
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
export const queues = {
  maintenance: new Queue(QUEUE_NAMES.MAINTENANCE, defaultQueueOptions),
  notifications: new Queue(QUEUE_NAMES.NOTIFICATIONS, defaultQueueOptions),
  healthScore: new Queue(QUEUE_NAMES.HEALTH_SCORE, defaultQueueOptions),
  dataProcessing: new Queue(QUEUE_NAMES.DATA_PROCESSING, defaultQueueOptions),
};

// Worker Options
export const defaultWorkerOptions: WorkerOptions = {
  connection: redisConfig,
  concurrency: 5, // Process 5 jobs at once per worker
};

// Type definition for Job Data
export interface JobData {
  customerId?: string;
  vehicleId?: string;
  type?: string;
  metadata?: any;
}
