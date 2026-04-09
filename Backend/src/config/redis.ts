import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redis: Redis | null = null;
let redisInitPromise: Promise<Redis | null> | null = null;
let redisReady = false;
let redisErrorLogged = false;

function isRedisConfigured(): boolean {
  const url = env.REDIS_URL;
  return Boolean(url && url !== "");
}

function logRedisUnavailable(message: string): void {
  if (!redisErrorLogged) {
    logger.warn(message);
    redisErrorLogged = true;
  }
}

function attachListeners(client: Redis): void {
  client.on("ready", () => {
    redisReady = true;
    redisErrorLogged = false;
    logger.info("Redis connected");
  });

  client.on("close", () => {
    redisReady = false;
    redisInitPromise = null;
  });

  client.on("end", () => {
    redisReady = false;
    redis = null;
    redisInitPromise = null;
    logRedisUnavailable("Redis connection ended; using in-memory fallback where available");
  });

  client.on("error", () => {
    redisReady = false;
    logRedisUnavailable("Redis unreachable; using in-memory fallback where available");
  });
}

export async function initRedis(): Promise<Redis | null> {
  if (!isRedisConfigured()) {
    return null;
  }
  if (redisReady && redis) {
    return redis;
  }
  if (redisInitPromise) {
    return redisInitPromise;
  }

  if (!redis) {
    redis = new Redis(env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    attachListeners(redis);
  }

  const client = redis;
  const initPromise = client
    .connect()
    .then(() => {
      redisReady = true;
      return client;
    })
    .catch(() => {
      logRedisUnavailable("Redis connect failed; using in-memory fallback where available");
      redisReady = false;
      redis = null;
      client.disconnect(false);
      return null;
    });
  const trackedPromise = initPromise.finally(() => {
    if (redisInitPromise === trackedPromise) {
      redisInitPromise = null;
    }
  });
  redisInitPromise = trackedPromise;

  return redisInitPromise;
}

/**
 * Get Redis client only when it is actually ready to accept commands.
 * Returns null when Redis is not configured or currently unavailable.
 */
export function getRedis(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }
  if (!redis) {
    void initRedis();
    return null;
  }
  if (!redisReady) {
    return null;
  }
  return redis;
}

export function getRedisStatus(): "ok" | "unavailable" | "not_configured" {
  if (!isRedisConfigured()) {
    return "not_configured";
  }
  return getRedis() ? "ok" : "unavailable";
}

export async function runRedisCommand<T>(
  operation: (client: Redis) => Promise<T>,
): Promise<T | null> {
  const client = getRedis();
  if (!client) {
    return null;
  }

  try {
    return await operation(client);
  } catch {
    redisReady = false;
    redisInitPromise = null;
    logRedisUnavailable("Redis command failed; using in-memory fallback where available");
    return null;
  }
}

/**
 * Close Redis connection (e.g. on app shutdown).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    const client = redis;
    redis = null;
    redisReady = false;
    redisInitPromise = null;

    try {
      await client.quit();
    } catch {
      client.disconnect(false);
    }

    logger.info("Redis disconnected");
  }
}
