import 'dotenv/config';
import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  var prisma: PrismaClient | undefined;
}

let connectionString = process.env.DATABASE_URL ?? '';
if (!connectionString || connectionString.trim() === '') {
  throw new Error(
    'DATABASE_URL is not set. For local dev, set it in Backend/.env (e.g. DATABASE_URL=postgresql://abhishekkumar@localhost:5432/valet_db?schema=customer)'
  );
}

// Only use SSL when the server expects it (e.g. RDS). Local Postgres does not support SSL.
let ssl: any = false;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');
    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    // Force SSL for RDS if not localhost and not explicitly disabled
    if (!isLocalhost && sslmode !== 'disable') {
      ssl = {
        rejectUnauthorized: false, // Standard for RDS/Cloud to avoid certificate chain errors
      };
      console.log(`🔒 Database: Enabling SSL for ${url.hostname} (sslmode: ${sslmode ?? 'default'})`);

      // IMPORTANT: Strip sslmode from the URL so the pg library doesn't try to 
      // apply its own stricter validation rules, which can override our ssl object.
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
    } else {
      console.log(`🔓 Database: Connecting without SSL to ${url.hostname}`);
    }

    // Log the connection target (masked)
    console.log(`🔌 Database: Connecting to ${url.hostname}:${url.port || '5432'}/${url.pathname.split('/').pop()}`);
  } catch (e) {
    console.warn('⚠️ Failed to parse DATABASE_URL for SSL configuration');
  }
}

const pool = new Pool({
  connectionString,
  ssl,
  // Limit connections to avoid exhausting DB slots under load
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_MS ?? 10000),
  connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONN_TIMEOUT_MS ?? 10000),
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client', err);
});
const adapter = new PrismaPg(pool);
export const dbInstances = (global.prisma ??
  new PrismaClient({ adapter })) as PrismaClient;

if (process.env.NODE_ENV !== 'production') global.prisma = dbInstances;

export * from '../generated/client';
