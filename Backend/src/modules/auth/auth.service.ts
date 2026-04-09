import { randomInt } from "crypto";
import { OAuth2Client } from "google-auth-library";
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
import { env } from "../../config/env";

function generateOtp(): string {
  return randomInt(100_000, 999_999).toString();
}

/** Normalize phone for DB lookup (store without +91 for consistency). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Always use last 10 digits for consistency (Indian phone format)
  return digits.slice(-10);
}

async function findCustomerByPhone(phoneNumber: string) {
  return dbInstances.customer.findUnique({
    where: { phoneNumber: normalizePhone(phoneNumber) },
  });
}

function buildOtpResponse(otp: string, requiresOtpVerification = false) {
  return {
    message: "OTP sent to your phone",
    ...(requiresOtpVerification && { requiresOtpVerification: true }),
    otpExpiresIn: env.OTP_EXPIRY_SEC,
    otpResendIn: env.OTP_RATE_LIMIT_WINDOW_SEC,
    ...(process.env.NODE_ENV === "development" && { otp }),
  };
}

export const authService = {
  async checkUser(phoneNumber: string) {
    const customer = await findCustomerByPhone(phoneNumber);
    if (!customer) {
      throw AppError.notFound("User not found");
    }

    return {
      exists: true,
      userId: customer.id,
      message: "User found",
    };
  },

  async signup(input: SignupInput) {
    const phone = normalizePhone(input.phoneNumber);
    const existing = await findCustomerByPhone(input.phoneNumber);
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
    
    return buildOtpResponse(otp, true);
  },

  async sendOtp(phoneNumber: string) {
    const customer = await findCustomerByPhone(phoneNumber);
    if (!customer) {
      throw AppError.notFound("User not found");
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
    
    return buildOtpResponse(otp);
  },

  async verifyOtp(input: VerifyOtpInput) {
    const stored = await otpStore.get(input.phoneNumber);
    if (!stored || stored !== input.otp) {
      throw AppError.unauthorized("Invalid or expired OTP");
    }
    await otpStore.delete(input.phoneNumber);
    const phone = normalizePhone(input.phoneNumber);
    const customer = await dbInstances.customer.findUnique({
      where: { phoneNumber: phone },
    });
    if (!customer) {
      throw AppError.notFound("User not found");
    }
    const payload = { id: customer.id, phoneNumber: customer.phoneNumber };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    return {
      message: "Verified",
      userId: customer.id,
      accessToken,
      refreshToken,
      expiresIn: getAccessExpirySeconds(),
    };
  },

  async login(phoneNumber: string) {
    await this.checkUser(phoneNumber);
    return this.sendOtp(phoneNumber);
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
      userId: payload.id,
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

  /**
   * Sign in with Google ID token. Verifies the token, then finds or creates
   * a customer and returns access + refresh tokens.
   */
  async signInWithGoogle(idToken: string) {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw AppError.badRequest(
        "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in the server environment.",
      );
    }
    const client = new OAuth2Client(clientId);
    let payload: { sub: string; email?: string; name?: string; picture?: string };
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const p = ticket.getPayload();
      if (!p?.sub) {
        throw new Error("Invalid token payload");
      }
      payload = {
        sub: p.sub,
        email: p.email ?? undefined,
        name: p.name ?? undefined,
        picture: p.picture ?? undefined,
      };
    } catch (err) {
      throw AppError.unauthorized(
        "Invalid or expired Google token. Please try signing in again.",
      );
    }

    const googleId = payload.sub;
    let customer = await dbInstances.customer.findUnique({
      where: { googleId },
    });
    if (!customer && payload.email) {
      customer = await dbInstances.customer.findFirst({
        where: { email: payload.email },
      });
    }
    if (!customer) {
      const placeholderPhone = `google_${googleId}`;
      customer = await dbInstances.customer.create({
        data: {
          googleId,
          phoneNumber: placeholderPhone,
          email: payload.email ?? null,
          fullName: payload.name ?? null,
          profilePic: payload.picture ?? null,
        },
      });
    } else if (!customer.googleId) {
      customer = await dbInstances.customer.update({
        where: { id: customer.id },
        data: {
          googleId,
          fullName: customer.fullName ?? payload.name ?? null,
          profilePic: customer.profilePic ?? payload.picture ?? null,
        },
      });
    }

    const jwtPayload = { id: customer.id, phoneNumber: customer.phoneNumber };
    const accessToken = signAccess(jwtPayload);
    const refreshToken = signRefresh(jwtPayload);
    return {
      message: "Signed in with Google",
      userId: customer.id,
      accessToken,
      refreshToken,
      expiresIn: getAccessExpirySeconds(),
    };
  },
};
