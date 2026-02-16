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
    logger.warn("REDIS_URL not set; OTP/refresh storage will use in-memory fallback");
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on("error", (err) => logger.error({ err }, "Redis error"));
    redis.on("connect", () => logger.info("Redis connected"));
    return redis;
  } catch (err) {
    logger.error({ err }, "Redis connection failed");
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
