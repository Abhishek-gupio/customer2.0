import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { signAdminAccess, getAdminAccessExpirySeconds } from "./admin.jwt";
import type { AdminLoginInput } from "./admin.validators";
import { logger } from "../../config/logger";
import { mailService } from "../../services/mail.service";
import { env } from "../../config/env";

const SALT_ROUNDS = 10;

/** In-memory OTP store for admin password resets (keyed by email). */
const adminOtpMemoryStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

const OTP_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_OTP_ATTEMPTS = 5;

export const adminService = {
  async login(input: AdminLoginInput) {
    const db = dbInstances;
    if (!db.adminUser) {
      logger.error("Prisma client has no adminUser model - run: cd prisma && pnpm run build");
      throw new Error("Admin auth not available: missing adminUser model. Rebuild prisma package.");
    }
    let admin;
    try {
      admin = await db.adminUser.findUnique({
        where: { email: input.email.toLowerCase().trim() },
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: unknown }).code)
          : "";
      if (code === "P2021") {
        throw AppError.internal(
          "Admin database tables are missing. Apply Prisma migrations to this DATABASE_URL: " +
            "cd prisma && pnpm prisma:migrate:deploy (or from repo root: pnpm --filter @repo/db-customer prisma:migrate:deploy)",
          "ADMIN_SCHEMA_MISSING",
        );
      }
      throw e;
    }
    if (!admin || !admin.isActive) {
      throw AppError.unauthorized("Invalid email or password");
    }
    const valid = await bcrypt.compare(input.password, admin.passwordHash);
    if (!valid) {
      throw AppError.unauthorized("Invalid email or password");
    }
    const payload = { id: admin.id, email: admin.email, role: admin.role };
    const accessToken = signAdminAccess(payload);
    return {
      accessToken,
      expiresIn: getAdminAccessExpirySeconds(),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  },

  /** Create admin user (for seeding; use SUPER_ADMIN only). */
  async createAdmin(data: {
    email: string;
    password: string;
    name?: string;
    role?: "SUPER_ADMIN" | "ADMIN" | "SUPPORT";
  }) {
    const db = dbInstances;
    const existing = await db.adminUser?.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw AppError.conflict("Admin with this email already exists");
    }
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    return db.adminUser.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name ?? null,
        role: (data.role ?? "ADMIN") as any,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  },

  /** Step 1: Send OTP to admin email for password reset. */
  async forgotPassword(email: string) {
    const db = dbInstances as any;
    const admin = await db.adminUser?.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Check if user exists
    if (!admin) {
      logger.warn({ email }, "Forgot password request for non-existent admin email");
      throw AppError.notFound("This email is not registered in our system.");
    }
    const otp = randomInt(100_000, 999_999).toString();
    adminOtpMemoryStore.set(email.toLowerCase().trim(), {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    });
    logger.info({ email }, "Admin password reset OTP generated and sent");
    await mailService.sendOtpEmail(email, otp);
    return { message: "If this email is registered, an OTP has been sent to your email." };
  },

  /** Step 2: Verify OTP (retry-safe — allows up to 5 wrong attempts). */
  async verifyForgotPasswordOtp(email: string, otp: string) {
    const key = email.toLowerCase().trim();
    const stored = adminOtpMemoryStore.get(key);

    if (!stored) {
      throw AppError.unauthorized("OTP not found. Please request a new one.");
    }
    if (Date.now() > stored.expiresAt) {
      adminOtpMemoryStore.delete(key);
      throw AppError.unauthorized("OTP has expired. Please request a new one.");
    }
    if (stored.attempts >= MAX_OTP_ATTEMPTS) {
      adminOtpMemoryStore.delete(key);
      throw AppError.unauthorized("Too many wrong attempts. Please request a new OTP.");
    }
    if (stored.otp !== otp.trim()) {
      // Increment attempts but keep OTP alive
      adminOtpMemoryStore.set(key, { ...stored, attempts: stored.attempts + 1 });
      const remaining = MAX_OTP_ATTEMPTS - stored.attempts - 1;
      throw AppError.unauthorized(
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : "Incorrect OTP. No more attempts left — please request a new OTP."
      );
    }
    // OTP correct — mark as verified but keep in store for resetPassword to validate
    return { message: "OTP verified", verified: true };
  },

  /** Step 3: Reset password — validates OTP one final time then deletes it. */
  async resetPassword(email: string, otp: string, newPassword: string) {
    const key = email.toLowerCase().trim();
    const stored = adminOtpMemoryStore.get(key);
    if (!stored || Date.now() > stored.expiresAt || stored.otp !== otp.trim()) {
      throw AppError.unauthorized("Invalid or expired OTP");
    }
    const db = dbInstances as any;
    const admin = await db.adminUser?.findUnique({ where: { email: key } });
    if (!admin) throw AppError.notFound("Admin not found");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.adminUser.update({
      where: { email: key },
      data: { passwordHash },
    });
    adminOtpMemoryStore.delete(key);
    logger.info({ email }, "Admin password successfully reset");
    return { message: "Password reset successfully" };
  },
};
