import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type { DealerPayload, ParkingEmployeePayload } from "./parking.types";

const SECRET = env.JWT_SECRET;

function parseExpiry(s: string): number {
  if (s.endsWith("m")) return parseInt(s, 10) * 60;
  if (s.endsWith("h")) return parseInt(s, 10) * 3600;
  if (s.endsWith("d")) return parseInt(s, 10) * 86400;
  return parseInt(s, 10) || 86400;
}

const dealerExpirySec = parseExpiry(env.DEALER_JWT_EXPIRY ?? "24h");
const employeeExpirySec = parseExpiry(env.PARKING_EMPLOYEE_JWT_EXPIRY ?? "24h");

/** Only enforced when present — see admin.jwt.ts's assertKind-equivalent comment for why. */
function assertKind(decoded: jwt.JwtPayload & { kind?: string }, expected: string): void {
  if (decoded.kind !== undefined && decoded.kind !== expected) {
    throw new Error(`Token kind mismatch: expected ${expected}, got ${decoded.kind}`);
  }
}

export function signDealerAccess(payload: DealerPayload): string {
  return jwt.sign({ ...payload, kind: "dealer" }, SECRET, { expiresIn: dealerExpirySec });
}

export function verifyDealerAccess(token: string): DealerPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & DealerPayload & { kind?: string };
  assertKind(decoded, "dealer");
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getDealerAccessExpirySeconds(): number {
  return dealerExpirySec;
}

export function signParkingEmployeeAccess(payload: ParkingEmployeePayload): string {
  return jwt.sign({ ...payload, kind: "parkingEmployee" }, SECRET, { expiresIn: employeeExpirySec });
}

export function verifyParkingEmployeeAccess(token: string): ParkingEmployeePayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & ParkingEmployeePayload & { kind?: string };
  assertKind(decoded, "parkingEmployee");
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getParkingEmployeeAccessExpirySeconds(): number {
  return employeeExpirySec;
}
