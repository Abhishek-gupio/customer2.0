import { randomInt } from "crypto";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import {
  blacklistRefreshToken,
  getAccessExpirySeconds,
  isRefreshBlacklisted,
  signAccess,
  signRefresh,
  verifyRefresh,
} from "./jwt";
import { otpStore } from "./otpStore";
import { getSMSService } from "../../services/sms.service";
import type { SignupInput, VerifyOtpInput } from "./auth.validators";

function generateOtp(): string {
  return randomInt(100_000, 999_999).toString();
}

/** Normalize phone for DB lookup (store without +91 for consistency). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export const authService = {
  async signup(input: SignupInput) {
    const phone = normalizePhone(input.phoneNumber);
    const existing = await dbInstances.customer.findUnique({
      where: { phoneNumber: phone },
    });
    if (existing) {
      throw AppError.conflict("Phone number already registered");
    }
    await dbInstances.customer.create({
      data: {
        phoneNumber: phone,
        email: input.email?.trim() || null,
        fullName: input.fullName?.trim() || null,
      },
    });
    const canSend = await otpStore.checkRateLimit(input.phoneNumber);
    if (!canSend) {
      throw AppError.tooManyRequests(
        "Please wait before requesting another OTP"
      );
    }
    const otp = generateOtp();
    await otpStore.set(input.phoneNumber, otp);
    await getSMSService().sendOTP(input.phoneNumber, otp);
    return {
      message: "OTP sent to your phone",
      requiresOtpVerification: true,
      ...(process.env.NODE_ENV === "development" && { otp }),
    };
  },

  async sendOtp(phoneNumber: string) {
    const canSend = await otpStore.checkRateLimit(phoneNumber);
    if (!canSend) {
      throw AppError.tooManyRequests(
        "Please wait before requesting another OTP"
      );
    }
    const otp = generateOtp();
    await otpStore.set(phoneNumber, otp);
    await getSMSService().sendOTP(phoneNumber, otp);
    return {
      message: "OTP sent to your phone",
      ...(process.env.NODE_ENV === "development" && { otp }),
    };
  },

  async verifyOtp(input: VerifyOtpInput) {
    const stored = await otpStore.get(input.phoneNumber);
    if (!stored || stored !== input.otp) {
      throw AppError.unauthorized("Invalid or expired OTP");
    }
    await otpStore.delete(input.phoneNumber);
    const phone = normalizePhone(input.phoneNumber);
    let customer = await dbInstances.customer.findUnique({
      where: { phoneNumber: phone },
    });
    if (!customer) {
      customer = await dbInstances.customer.create({
        data: { phoneNumber: phone },
      });
    }
    const payload = { id: customer.id, phoneNumber: customer.phoneNumber };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    return {
      message: "Verified",
      accessToken,
      refreshToken,
      expiresIn: getAccessExpirySeconds(),
    };
  },

  async login(phoneNumber: string) {
    const phone = normalizePhone(phoneNumber);
    const existing = await dbInstances.customer.findUnique({
      where: { phoneNumber: phone },
    });
    if (!existing) {
      throw AppError.notFound("Please sign up");
    }
    const canSend = await otpStore.checkRateLimit(phoneNumber);
    if (!canSend) {
      throw AppError.tooManyRequests(
        "Please wait before requesting another OTP"
      );
    }
    const otp = generateOtp();
    await otpStore.set(phoneNumber, otp);
    await getSMSService().sendOTP(phoneNumber, otp);
    return {
      message: "OTP sent to your phone",
      requiresOtpVerification: true,
      ...(process.env.NODE_ENV === "development" && { otp }),
    };
  },

  async refresh(refreshToken: string) {
    const blacklisted = await isRefreshBlacklisted(refreshToken);
    if (blacklisted) {
      throw AppError.unauthorized("Token revoked");
    }
    const payload = verifyRefresh(refreshToken);
    const accessToken = signAccess(payload);
    const newRefreshToken = signRefresh(payload);
    await blacklistRefreshToken(refreshToken);
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: getAccessExpirySeconds(),
    };
  },

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await blacklistRefreshToken(refreshToken);
    }
    return { message: "Logged out" };
  },

  async getProfile(id: string) {
    const customer = await dbInstances.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vehicles: true, documents: true }
        }
      }
    });
    if (!customer) throw AppError.notFound("Customer not found");
    return customer;
  },
};
