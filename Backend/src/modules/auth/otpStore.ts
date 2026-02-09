import { getRedis } from "../../config/redis";
import { env } from "../../config/env";

const OTP_PREFIX = "otp:";
const OTP_RATE_PREFIX = "otp:rate:";
const TTL = env.OTP_EXPIRY_SEC;
const RATE_WINDOW = env.OTP_RATE_LIMIT_WINDOW_SEC;

/** In-memory fallback when Redis is not available. */
const memoryStore = new Map<string, { otp: string; expiresAt: number }>();
const memoryRateStore = new Map<string, number>();

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export const otpStore = {
  async set(phoneNumber: string, otp: string): Promise<void> {
    const key = normalizePhone(phoneNumber);
    const redis = getRedis();
    if (redis) {
      await redis.setex(`${OTP_PREFIX}${key}`, TTL, otp);
      return;
    }
    memoryStore.set(key, { otp, expiresAt: Date.now() + TTL * 1000 });
  },

  async get(phoneNumber: string): Promise<string | null> {
    const key = normalizePhone(phoneNumber);
    const redis = getRedis();
    if (redis) {
      return redis.get(`${OTP_PREFIX}${key}`);
    }
    const entry = memoryStore.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return entry.otp;
  },

  async delete(phoneNumber: string): Promise<void> {
    const key = normalizePhone(phoneNumber);
    const redis = getRedis();
    if (redis) {
      await redis.del(`${OTP_PREFIX}${key}`);
      return;
    }
    memoryStore.delete(key);
  },

  /** Returns true if we can send OTP (rate limit not exceeded). */
  async checkRateLimit(phoneNumber: string): Promise<boolean> {
    const key = normalizePhone(phoneNumber);
    const redis = getRedis();
    if (redis) {
      const k = `${OTP_RATE_PREFIX}${key}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, RATE_WINDOW);
      return n <= 1;
    }
    const last = memoryRateStore.get(key) ?? 0;
    if (Date.now() - last < RATE_WINDOW * 1000) return false;
    memoryRateStore.set(key, Date.now());
    return true;
  },
};
