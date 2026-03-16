import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Add new values to the enum
    // Note: We use IF NOT EXISTS logic manually if possible, or just catch the error
    const categories = ['DOCUMENTS', 'VALET', 'AI_ASSISTANT', 'ACCOUNT'];
    
    for (const category of categories) {
        try {
            // Check if it's in the customer schema or public
            // Prisma schema says @@schema("customer")
            await client.query(`ALTER TYPE "customer"."TicketCategory" ADD VALUE IF NOT EXISTS '${category}'`);
            console.log(`Added ${category} successfully.`);
        } catch (e: any) {
            console.log(`Skipping ${category}: ${e.message}`);
        }
    }

    // Also update the default value for the table if we want to be thorough
    // but Prisma handles that in the client usually.
    // Let's check the current default.
    const res = await client.query(`
        SELECT column_default 
        FROM information_schema.columns 
        WHERE table_schema = 'customer' 
        AND table_name = 'SupportTicket' 
        AND column_name = 'category'
    `);
    console.log('Current default:', res.rows[0]?.column_default);

    if (res.rows[0]?.column_default?.includes('GENERAL')) {
        await client.query(`ALTER TABLE "customer"."SupportTicket" ALTER COLUMN "category" SET DEFAULT 'OTHER'::"customer"."TicketCategory"`);
        console.log('Updated default to OTHER.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
