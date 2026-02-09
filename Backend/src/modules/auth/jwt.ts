import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { getRedis } from "../../config/redis";
import type { CustomerPayload } from "./auth.types";

const SECRET = env.JWT_SECRET;
const ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY;
const REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRY;
const REFRESH_PREFIX = "refresh:";

function parseExpiry(s: string): number {
  if (s.endsWith("m")) return parseInt(s, 10) * 60;
  if (s.endsWith("h")) return parseInt(s, 10) * 3600;
  if (s.endsWith("d")) return parseInt(s, 10) * 86400;
  return parseInt(s, 10) || 900;
}

const accessExpirySec = parseExpiry(ACCESS_EXPIRY);
const refreshExpirySec = parseExpiry(REFRESH_EXPIRY);

export function signAccess(payload: CustomerPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: accessExpirySec });
}

export function signRefresh(payload: CustomerPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: refreshExpirySec });
}

export function verifyAccess(token: string): CustomerPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & CustomerPayload;
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function verifyRefresh(token: string): CustomerPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & CustomerPayload;
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getAccessExpirySeconds(): number {
  return accessExpirySec;
}

/** Blacklist refresh token (store in Redis or in-memory until expiry). */
export async function blacklistRefreshToken(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded?.exp) return;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;
    const redis = getRedis();
    if (redis) {
      await redis.setex(`${REFRESH_PREFIX}${token}`, ttl, "1");
    }
  } catch {
    // ignore
  }
}

/** Check if refresh token is blacklisted. */
export async function isRefreshBlacklisted(token: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const v = await redis.get(`${REFRESH_PREFIX}${token}`);
  return v === "1";
}
