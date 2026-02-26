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
let ssl: boolean | { rejectUnauthorized: boolean } = false;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');
    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (
      !isLocalhost &&
      (sslmode === 'require' || sslmode === 'verify-full' || sslmode === 'no-verify')
    ) {
      ssl = { rejectUnauthorized: sslmode === 'verify-full' };
    }
    // Strip sslmode from URL so pg uses our ssl option instead
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch (e) {
    // Ignore URL parse errors
  }
}

const pool = new Pool({
  connectionString,
  ssl,
  max: Number(process.env.PG_POOL_MAX ?? 20),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 10_000),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  keepAlive: true,
  keepAliveInitialDelayMillis: Number(
    process.env.PG_KEEPALIVE_DELAY_MS ?? 10_000,
  ),
  maxLifetimeSeconds: Number(process.env.PG_MAX_LIFETIME_SEC ?? 300),
});

pool.on('error', (err) => {
  // Prevent uncaught pool errors from crashing request handlers.
  console.warn('[db-customer] PostgreSQL pool error:', err?.message ?? err);
});
const adapter = new PrismaPg(pool);
export const dbInstances = (global.prisma ??
  new PrismaClient({ adapter })) as PrismaClient;

if (process.env.NODE_ENV !== 'production') global.prisma = dbInstances;

export * from '../generated/client';
