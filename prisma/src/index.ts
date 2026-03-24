/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnvFile } from 'dotenv';
import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

declare global {
  var prisma: PrismaClient | undefined;
  var pool: Pool | undefined;
}

/** Matches docker-compose.yml (postgres:16, user/db abhishekkumar / valet_db). */
const LOCAL_DOCKER_DATABASE_URL =
  'postgresql://abhishekkumar@localhost:5432/valet_db?schema=customer';

// dotenv only loads cwd/.env by default; Backend often runs with no root .env. Merge known paths (later files do not override existing vars).
const projectCwd = process.cwd?.() ?? '.';
const envCandidates = [
  join(projectCwd, '.env'),
  join(projectCwd, 'Backend', '.env'),
  // prisma/dist/src -> ../../.env = prisma package .env
  join(__dirname, '../../.env'),
  // monorepo Backend/.env
  join(__dirname, '../../../Backend', '.env'),
];
for (const p of envCandidates) {
  if (existsSync(p)) {
    loadEnvFile({ path: p });
  }
}

let connectionString = (process.env.DATABASE_URL ?? '').trim();
if (!connectionString && process.env.NODE_ENV !== 'production') {
  connectionString = LOCAL_DOCKER_DATABASE_URL;
  console.warn(
    '[@repo/db-customer] DATABASE_URL not set; using local Docker Compose default. Add DATABASE_URL to Backend/.env (see Backend/.env.example).',
  );
}
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. For local dev: copy Backend/.env.example to Backend/.env, run `docker compose up -d`, or set DATABASE_URL (e.g. postgresql://abhishekkumar@localhost:5432/valet_db?schema=customer)',
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
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_MS ?? 10000),
  connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONN_TIMEOUT_MS ?? 10000),
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle database client', err);
});

const adapter = new PrismaPg(pool);
const dbInstances = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = dbInstances;
  global.pool = pool;
}

export { dbInstances };

export const disconnect = async () => {
  console.log('🔌 Database: Closing connections...');
  if (global.prisma) {
    await (global.prisma as PrismaClient).$disconnect();
  }
  if (global.pool) {
    await (global.pool as Pool).end();
  }
};

export * from '../generated/client';