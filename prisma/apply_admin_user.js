const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgrestest:Testing_db@valet-testdb.cnokog8wwq51.ap-south-1.rds.amazonaws.com:5432/valet_db',
  ssl: { rejectUnauthorized: false }
});
c.connect().then(async () => {
  console.log('Connected!');

  // Create enum if not exists
  await c.query(`
    DO $$ BEGIN
      CREATE TYPE "customer"."AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  console.log('AdminRole enum OK');

  // Create AdminUser table if not exists
  await c.query(`
    CREATE TABLE IF NOT EXISTS "customer"."AdminUser" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT,
      "role" "customer"."AdminRole" NOT NULL DEFAULT 'ADMIN',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('AdminUser table OK');

  // Create unique index if not exists
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "customer"."AdminUser"("email")
  `).catch(e => console.log('Index note:', e.message));
  console.log('AdminUser_email_key index OK');

  // Verify
  const check = await c.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='customer' AND table_name='AdminUser'`);
  console.log('AdminUser table confirmed:', check.rows[0].count === '1' ? 'YES' : 'NO');

  c.end();
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
