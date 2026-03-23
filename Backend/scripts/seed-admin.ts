/**
 * Seed first admin user. Run from Backend: npx ts-node scripts/seed-admin.ts
 * Or: pnpm exec ts-node scripts/seed-admin.ts
 *
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in env, or pass as args:
 * ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret pnpm exec ts-node scripts/seed-admin.ts
 */
import "dotenv/config";
import { dbInstances } from "@repo/db-customer";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

async function main() {
  const email = process.env.ADMIN_EMAIL ?? process.argv[2] ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? process.argv[3] ?? "Admin@123";

  const existing = await dbInstances.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.log("Admin already exists:", email);
    process.exit(0);
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await dbInstances.adminUser.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: "Admin",
      role: "SUPER_ADMIN",
    },
  });
  console.log("Admin created:", email, "(role: SUPER_ADMIN)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
