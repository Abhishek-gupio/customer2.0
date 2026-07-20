import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { PartnerPayload, TechnicianPayload } from "./carwash.types";

const SECRET = env.JWT_SECRET;

function parseExpiry(s: string): number {
  if (s.endsWith("m")) return parseInt(s, 10) * 60;
  if (s.endsWith("h")) return parseInt(s, 10) * 3600;
  if (s.endsWith("d")) return parseInt(s, 10) * 86400;
  return parseInt(s, 10) || 86400;
}

const partnerExpirySec = parseExpiry(env.WASH_PARTNER_JWT_EXPIRY ?? "24h");
const technicianExpirySec = parseExpiry(env.WASH_TECHNICIAN_JWT_EXPIRY ?? "24h");

export function signPartnerAccess(payload: PartnerPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: partnerExpirySec });
}

export function verifyPartnerAccess(token: string): PartnerPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & PartnerPayload;
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getPartnerAccessExpirySeconds(): number {
  return partnerExpirySec;
}

/// A technician is the field worker under a WashPartner — its own JWT role,
/// distinct from the partner (business owner) that manages them. See
/// docs/gupio-carwash-platform-plan.md §11 for why this separation matters:
/// least-privilege — a technician can only act on jobs assigned to them, not
/// manage centers/slots/other technicians.
export function signTechnicianAccess(payload: TechnicianPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: technicianExpirySec });
}

export function verifyTechnicianAccess(token: string): TechnicianPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & TechnicianPayload;
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getTechnicianAccessExpirySeconds(): number {
  return technicianExpirySec;
}
