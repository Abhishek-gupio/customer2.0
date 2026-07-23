import { dbInstances } from "@repo/db-customer";

const prisma = dbInstances;

async function main() {
  console.log("Applying schema changes directly to RDS...");

  try {
    // 1. Add commissionRate to ParkingDealer
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingDealer" ADD COLUMN IF NOT EXISTS "commissionRate" INTEGER NOT NULL DEFAULT 10;
    `);
    console.log("Added commissionRate to ParkingDealer");
  } catch (e: any) { console.error(e.message) }

  try {
    // 2. Add isSettled, settlementId to ParkingBooking
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingBooking" ADD COLUMN IF NOT EXISTS "isSettled" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingBooking" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
    `);
    console.log("Added isSettled to ParkingBooking");
  } catch (e: any) { console.error(e.message) }

  try {
    // 3. Add isSettled, settlementId to ParkingWalkIn
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingWalkIn" ADD COLUMN IF NOT EXISTS "isSettled" BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingWalkIn" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
    `);
    console.log("Added isSettled to ParkingWalkIn");
  } catch (e: any) { console.error(e.message) }

  try {
    // 4. Create SettlementStatus enum
    await prisma.$executeRawUnsafe(`
      CREATE TYPE customer."SettlementStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
    `);
    console.log("Created SettlementStatus enum");
  } catch (e: any) { console.error(e.message) }

  try {
    // 5. Create ParkingSettlement table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS customer."ParkingSettlement" (
          "id" TEXT NOT NULL,
          "dealerId" TEXT NOT NULL,
          "date" DATE NOT NULL,
          "totalCollected" INTEGER NOT NULL,
          "gupioCommission" INTEGER NOT NULL,
          "amountSettled" INTEGER NOT NULL,
          "status" customer."SettlementStatus" NOT NULL DEFAULT 'PENDING',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "ParkingSettlement_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log("Created ParkingSettlement table");
  } catch (e: any) { console.error(e.message) }

  try {
    // 6. Add Foreign Keys for ParkingSettlement
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingSettlement" ADD CONSTRAINT "ParkingSettlement_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES customer."ParkingDealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
    console.log("Added dealer foreign key to ParkingSettlement");
  } catch (e: any) { console.error(e.message) }

  try {
    // 7. Add Foreign Keys for bookings and walkins to settlement
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingBooking" ADD CONSTRAINT "ParkingBooking_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES customer."ParkingSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE customer."ParkingWalkIn" ADD CONSTRAINT "ParkingWalkIn_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES customer."ParkingSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log("Added settlement foreign keys to Booking and WalkIn");
  } catch (e: any) { console.error(e.message) }
  
  try {
    // Add PARKING_WALKIN_PAYMENT to PaymentPurpose enum
    await prisma.$executeRawUnsafe(`
      ALTER TYPE customer."PaymentPurpose" ADD VALUE IF NOT EXISTS 'PARKING_WALKIN_PAYMENT';
    `);
    console.log("Added PARKING_WALKIN_PAYMENT to PaymentPurpose");
  } catch (e: any) { console.error(e.message) }

  console.log("Done.");
}

main().catch(console.error);
