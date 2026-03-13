/**
 * One-off: run PartReplacementInterval migration SQL.
 * Usage: node scripts/run-part-interval-migration.mjs
 * Requires: DATABASE_URL in prisma/.env
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let connectionString = process.env.DATABASE_URL || '';
if (!connectionString) {
  console.error('DATABASE_URL not set. Set it in prisma/.env');
  process.exit(1);
}

const url = new URL(connectionString);
url.searchParams.delete('schema');
url.searchParams.delete('sslmode');
const cleanUrl = url.toString();

const isRemote = url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
const client = new pg.Client({
  connectionString: cleanUrl,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
});

const sqlPath = join(__dirname, '../prisma/migrations/20260313000000_add_part_replacement_interval_customer/migration.sql');
const sql = readFileSync(sqlPath, 'utf8');

async function main() {
  try {
    await client.connect();
    await client.query(sql);
    console.log('PartReplacementInterval table created successfully.');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('PartReplacementInterval table already exists.');
    } else {
      console.error('Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main();
