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

function isTransientDbError(error: unknown): boolean {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as any).message === "string"
      ? (error as any).message.toLowerCase()
      : "";

  return (
    message.includes("connection terminated unexpectedly") ||
    message.includes("connection closed") ||
    message.includes("terminating connection") ||
    message.includes("econnreset") ||
    message.includes("timeout")
  );
}

async function withDbRetry<T>(op: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (retries > 0 && isTransientDbError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return withDbRetry(op, retries - 1);
    }
    throw error;
  }
}

/** Normalize phone for DB lookup (store without +91 for consistency). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Always use last 10 digits for consistency (Indian phone format)
  return digits.slice(-10);
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
        "Please wait before requesting another OTP",
      );
    }
    const otp = generateOtp();
    console.log(`📱 Generating OTP for ${input.phoneNumber}: ${otp}`);
    await otpStore.set(input.phoneNumber, otp);
    console.log(`✅ OTP stored for ${input.phoneNumber}`);
    
    try {
      const result = await getSMSService().sendOTP(input.phoneNumber, otp);
      console.log(`📤 SMS Service Result: ${result ? "Success" : "Failed"}`);
    } catch (error) {
      console.error(`❌ SMS Service Error:`, error);
    }
    
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
        "Please wait before requesting another OTP",
      );
    }
    const otp = generateOtp();
    console.log(`📱 Generating OTP for ${phoneNumber}: ${otp}`);
    await otpStore.set(phoneNumber, otp);
    console.log(`✅ OTP stored for ${phoneNumber}`);
    
    try {
      const result = await getSMSService().sendOTP(phoneNumber, otp);
      console.log(`📤 SMS Service Result: ${result ? "Success" : "Failed"}`);
    } catch (error) {
      console.error(`❌ SMS Service Error:`, error);
    }
    
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
    let customer = await withDbRetry(() =>
      dbInstances.customer.findUnique({
        where: { phoneNumber: phone },
      }),
    );
    if (!customer) {
      customer = await withDbRetry(() =>
        dbInstances.customer.create({
          data: { phoneNumber: phone },
        }),
      );
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
        "Please wait before requesting another OTP",
      );
    }
    const otp = generateOtp();
    console.log(`📱 Generating OTP for ${phoneNumber}: ${otp}`);
    await otpStore.set(phoneNumber, otp);
    console.log(`✅ OTP stored for ${phoneNumber}`);
    
    try {
      const result = await getSMSService().sendOTP(phoneNumber, otp);
      console.log(`📤 SMS Service Result: ${result ? "Success" : "Failed"}`);
    } catch (error) {
      console.error(`❌ SMS Service Error:`, error);
    }
    
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
          select: { vehicles: true, documents: true },
        },
      },
    });
    if (!customer) throw AppError.notFound("Customer not found");
    return customer;
  },
};
