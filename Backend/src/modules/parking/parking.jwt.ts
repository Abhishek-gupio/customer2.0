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

export function signDealerAccess(payload: DealerPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: dealerExpirySec });
}

export function verifyDealerAccess(token: string): DealerPayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & DealerPayload;
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getDealerAccessExpirySeconds(): number {
  return dealerExpirySec;
}

export function signParkingEmployeeAccess(payload: ParkingEmployeePayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: employeeExpirySec });
}

export function verifyParkingEmployeeAccess(token: string): ParkingEmployeePayload {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & ParkingEmployeePayload;
  return { id: decoded.id, phoneNumber: decoded.phoneNumber };
}

export function getParkingEmployeeAccessExpirySeconds(): number {
  return employeeExpirySec;
}
