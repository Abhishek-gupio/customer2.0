import { Client } from 'pg';
import "dotenv/config";

async function verify() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true
  });

  try {
    await client.connect();
    const res = await client.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'TicketCategory'
    `);
    console.log('Database Categories:', res.rows.map(r => r.enumlabel).sort());
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

verify();
