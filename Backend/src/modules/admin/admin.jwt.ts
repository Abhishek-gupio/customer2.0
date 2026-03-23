import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { AdminPayload } from "./admin.types";

const SECRET = env.JWT_SECRET;

function parseExpiry(s: string): number {
  if (s.endsWith("m")) return parseInt(s, 10) * 60;
  if (s.endsWith("h")) return parseInt(s, 10) * 3600;
  if (s.endsWith("d")) return parseInt(s, 10) * 86400;
  return parseInt(s, 10) || 86400;
}

const adminExpirySec = parseExpiry(env.ADMIN_JWT_EXPIRY ?? "24h");

export function signAdminAccess(payload: AdminPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: adminExpirySec });
}

export function verifyAdminAccess(token: string): AdminPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & AdminPayload;
  return { id: decoded.id, email: decoded.email, role: decoded.role };
}

export function getAdminAccessExpirySeconds(): number {
  return adminExpirySec;
}
