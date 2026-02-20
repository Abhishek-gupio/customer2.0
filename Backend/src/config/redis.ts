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
    logger.warn(
      "REDIS_URL not set; OTP/refresh storage will use in-memory fallback",
    );
    return null;
  }
  try {
    // Create client in lazy mode so we can attach handlers before attempting
    // the network connect. This avoids noisy stack traces when Redis isn't
    // running in development.
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("error", (err) => {
      if (!redisErrorLogged) {
        logger.warn("Redis unreachable; using in-memory fallback for OTP/locks");
        redisErrorLogged = true;
      }
    });

    redis.on("connect", () => {
      redisErrorLogged = false;
      logger.info("Redis connected");
    });

    // Attempt to connect; if it fails the promise will be rejected and we
    // switch to in-memory fallback without throwing an uncaught exception.
    redis.connect().catch((err) => {
      if (!redisErrorLogged) {
        logger.warn("Redis connect failed; using in-memory fallback for OTP/locks");
        redisErrorLogged = true;
      }
      try {
        // Best-effort cleanup
        redis?.quit();
      } catch {}
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
