import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redis: Redis | null = null;

/**
 * Get Redis client. Returns null if REDIS_URL is not set (e.g. dev without Redis).
 * Callers should handle null (e.g. use in-memory fallback for OTP).
 */
export function getRedis(): Redis | null {
  if (redis !== null) return redis;
  const url = env.REDIS_URL;
  if (!url || url === "") {
    logger.warn(
      "REDIS_URL not set; OTP/refresh storage will use in-memory fallback",
    );
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: false,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      // Suppress repetitive connection errors in dev
      if (process.env.NODE_ENV !== "development") {
        logger.error({ err }, "Redis error");
      }
    });
    redis.on("connect", () => logger.info("Redis connected"));
    redis.connect().catch(() => {
      // Silently fail - will use in-memory fallback
      redis = null;
    });
    return redis;
  } catch (err) {
    // Silently fail in dev - will use in-memory fallback
    if (process.env.NODE_ENV !== "development") {
      logger.error({ err }, "Redis connection failed");
    }
    return null;
  }
}

/**
 * Close Redis connection (e.g. on app shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info("Redis disconnected");
  }
}
