import bcrypt from "bcryptjs";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { signAdminAccess, getAdminAccessExpirySeconds } from "./admin.jwt";
import type { AdminLoginInput } from "./admin.validators";
import { logger } from "../../config/logger";

const SALT_ROUNDS = 10;

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
};
