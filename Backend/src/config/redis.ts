import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redis: Redis | null = null;
let redisReady = false;
let redisConnecting = false;
let redisErrorLogged = false;

function ensureRedisClient(): void {
  const url = env.REDIS_URL;
  if (!url || redis) return;

  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    enableReadyCheck: true,
    enableOfflineQueue: false,
  });

  redis.on("error", () => {
    redisReady = false;
    if (!redisErrorLogged) {
      logger.warn("Redis unreachable; using in-memory fallback for OTP/locks");
      redisErrorLogged = true;
    }
  });

  redis.on("ready", () => {
    redisReady = true;
    redisConnecting = false;
    redisErrorLogged = false;
    logger.info("Redis connected");
  });

  redis.on("close", () => {
    redisReady = false;
    redisConnecting = false;
  });

  redis.on("end", () => {
    redisReady = false;
    redisConnecting = false;
  });

  if (!redisConnecting) {
    redisConnecting = true;
    redis.connect().catch(() => {
      redisReady = false;
      redisConnecting = false;
      if (!redisErrorLogged) {
        logger.warn("Redis connect failed; using in-memory fallback for OTP/locks");
        redisErrorLogged = true;
      }
    });
  }
}

/**
 * Get Redis client. Returns null if REDIS_URL is not set (e.g. dev without Redis).
 * Callers should handle null (e.g. use in-memory fallback for OTP).
 */
export function getRedis(): Redis | null {
  const url = env.REDIS_URL;
  if (!url || url === "") {
    // Fully silent: do not log or connect if REDIS_URL is not set
    return null;
  }
  try {
    ensureRedisClient();
    return redisReady ? redis : null;
  } catch {
    logger.warn("Redis initialization failed; using in-memory fallback");
    redisReady = false;
    redisConnecting = false;
    redis = null;
    return null;
  }
}

/**
 * Close Redis connection (e.g. on app shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    redisReady = false;
    redisConnecting = false;
    logger.info("Redis disconnected");
  }
}
