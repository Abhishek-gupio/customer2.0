import { Client } from 'pg';
import "dotenv/config";

async function check() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true
  });

  try {
    await client.connect();
    console.log('CONNECTED');
    
    const res = await client.query(`
        SELECT n.nspname as enum_schema,  
               t.typname as enum_name,  
               e.enumlabel as enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'TicketCategory'
    `);
    
    console.log('Found categories:', res.rows.map(r => r.enum_value).join(', '));

    const categoriesToAdd = ['DOCUMENTS', 'VALET', 'AI_ASSISTANT', 'ACCOUNT'];
    const existing = res.rows.map(r => r.enum_value);

    for (const cat of categoriesToAdd) {
        if (!existing.includes(cat)) {
            console.log(`Adding ${cat}...`);
            await client.query(`ALTER TYPE "customer"."TicketCategory" ADD VALUE '${cat}'`);
        } else {
            console.log(`${cat} already exists.`);
        }
    }
    
    console.log('DONE');
  } catch (err: any) {
    console.error('ERROR:', err.message);
  } finally {
    await client.end();
  }
}

check();
