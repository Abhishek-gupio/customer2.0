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
  return jwt.sign({ ...payload, kind: "admin" }, SECRET, { expiresIn: adminExpirySec });
}

/**
 * Two independent checks, both needed: `kind` (soft — only enforced when
 * present, so tokens signed before this claim existed keep working until
 * they expire) catches a non-admin token relabeled as admin at the JWT
 * layer; `role` (hard — always required) is the real backstop, since it's
 * the one field that has always been admin-only and every customer/dealer/
 * employee token — regardless of `kind` — simply never has it set.
 */
export function verifyAdminAccess(token: string): AdminPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & AdminPayload & { kind?: string };
  if (decoded.kind !== undefined && decoded.kind !== "admin") {
    throw new Error(`Token kind mismatch: expected admin, got ${decoded.kind}`);
  }
  if (!decoded.role) {
    throw new Error("Token is missing admin role — not a genuine admin token");
  }
  return { id: decoded.id, email: decoded.email, name: decoded.name ?? null, role: decoded.role };
}

export function getAdminAccessExpirySeconds(): number {
  return adminExpirySec;
}
