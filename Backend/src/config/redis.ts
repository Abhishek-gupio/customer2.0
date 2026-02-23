import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redis: Redis | null = null;
let redisErrorLogged = false;

/**
 * Get Redis client. Returns null if REDIS_URL is not set (e.g. dev without Redis).
 * Callers should handle null (e.g. use in-memory fallback for OTP).
 */
export function getRedis(): Redis | null {
  if (redis !== null) return redis;
  const url = env.REDIS_URL;
  if (!url || url === "") {
    // Fully silent: do not log or connect if REDIS_URL is not set
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: false,
      enableOfflineQueue: false,
    });

    redis.on("error", (err) => {
      if (!redisErrorLogged) {
        // Only log once per session if REDIS_URL is set
        logger.warn("Redis unreachable; using in-memory fallback for OTP/locks");
        redisErrorLogged = true;
      }
    });

    redis.on("connect", () => {
      redisErrorLogged = false;
      logger.info("Redis connected");
    });

    redis.connect().catch((err) => {
      if (!redisErrorLogged) {
        logger.warn("Redis connect failed; using in-memory fallback for OTP/locks");
        redisErrorLogged = true;
      }
      // Do NOT call redis.quit() here, just set redis to null
      redis = null;
    });

    return redis;
  } catch (err) {
    logger.warn("Redis initialization failed; using in-memory fallback");
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
