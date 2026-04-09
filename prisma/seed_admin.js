const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DB_URL = 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db';

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const email = 'admin@example.com';
  const password = 'Admin@123';
  const passwordHash = await bcrypt.hash(password, 10);

  // Check if already exists
  const existing = await c.query(`SELECT id, email FROM "customer"."AdminUser" WHERE email = $1`, [email]);
  
  if (existing.rows.length > 0) {
    // Update the password hash for existing user
    await c.query(
      `UPDATE "customer"."AdminUser" SET "passwordHash" = $1, "isActive" = true, "role" = 'SUPER_ADMIN' WHERE email = $2`,
      [passwordHash, email]
    );
    console.log('✅ Updated existing admin user:', email);
  } else {
    // Create new admin
    const cuid = 'admin_' + Date.now();
    const now = new Date().toISOString();
    await c.query(
      `INSERT INTO "customer"."AdminUser" (id, email, "passwordHash", name, role, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [cuid, email, passwordHash, 'Super Admin', 'SUPER_ADMIN', true, now, now]
    );
    console.log('✅ Created admin user:', email);
  }

  // Also fix any user that has a plain-text password (from Prisma Studio entry)
  const allUsers = await c.query(`SELECT id, email, "passwordHash" FROM "customer"."AdminUser"`);
  console.log('\nAll admin users:');
  for (const u of allUsers.rows) {
    const isHashed = u.passwordHash.startsWith('$2');
    console.log(`  - ${u.email} | hash ok: ${isHashed}`);
    if (!isHashed) {
      // Re-hash the plain text password they entered
      const newHash = await bcrypt.hash(u.passwordHash, 10);
      await c.query(`UPDATE "customer"."AdminUser" SET "passwordHash" = $1 WHERE id = $2`, [newHash, u.id]);
      console.log(`    -> Fixed bcrypt hash for ${u.email} (password was: ${u.passwordHash})`);
    }
  }

  console.log('\n🎉 Login credentials:');
  console.log('   Email:    admin@example.com');
  console.log('   Password: Admin@123');
  
  await c.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
