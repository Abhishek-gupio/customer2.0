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

// Use SSL for any remote host (e.g. RDS). Required by RDS pg_hba.conf ("no encryption" rejected).
let ssl: boolean | { rejectUnauthorized: boolean } = false;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');
    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    // Force SSL for non-localhost so RDS accepts the connection (no "no encryption" rejection)
    if (!isLocalhost && sslmode !== 'disable') {
      ssl = { rejectUnauthorized: false };
      console.log(`🔒 Database: SSL enabled for ${url.hostname}`);
      url.searchParams.delete('sslmode');
      connectionString = url.toString();
    } else if (isLocalhost) {
      console.log(`🔓 Database: No SSL to ${url.hostname}`);
    }

    console.log(`🔌 Database: ${url.hostname}:${url.port || '5432'}/${url.pathname.split('/').pop()}`);
  } catch (e) {
    console.warn('⚠️ Failed to parse DATABASE_URL for SSL');
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
