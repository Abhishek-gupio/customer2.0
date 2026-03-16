import "dotenv/config";
import { dbInstances } from "@repo/db-customer";

async function fixEnums() {
  try {
    console.log("Connecting to database through backend infrastructure...");
    
    // We can use $executeRawUnsafe to run ALTER TYPE commands
    // We add VALUE ONLY IF NOT EXISTS. PostgreSQL doesn't have IF NOT EXISTS for ADD VALUE directly in older versions, 
    // but we can check if it exists first.
    
    const categories = ['VEHICLE', 'DOCUMENTS', 'VALET', 'AI_ASSISTANT', 'BILLING', 'ACCOUNT', 'TECHNICAL', 'APP_ISSUE', 'OTHER'];
    
    for (const category of categories) {
      try {
        // This is a safer way to add enum values if they might already exist
        await (dbInstances as any).customer.$executeRawUnsafe(
          `ALTER TYPE "customer"."TicketCategory" ADD VALUE '${category}'`
        );
        console.log(`Successfully added category: ${category}`);
      } catch (err: any) {
        if (err.message.includes("already exists")) {
          console.log(`Category ${category} already exists, skipping.`);
        } else {
          console.error(`Error adding ${category}:`, err.message);
        }
      }
    }

    // Fix the default value
    await (dbInstances as any).customer.$executeRawUnsafe(
      `ALTER TABLE "customer"."SupportTicket" ALTER COLUMN "category" SET DEFAULT 'OTHER'::"customer"."TicketCategory"`
    );
    console.log("Updated SupportTicket category default to OTHER");

    process.exit(0);
  } catch (error) {
    console.error("Migration script failed:", error);
    process.exit(1);
  }
}

fixEnums();
