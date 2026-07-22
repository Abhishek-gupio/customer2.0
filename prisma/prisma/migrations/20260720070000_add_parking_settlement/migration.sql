-- This migration documents changes that were already applied directly to
-- the shared dev/test DB outside of `prisma migrate` (confirmed via psql).
-- It is recorded here — and marked resolved rather than re-run on that DB —
-- purely so a fresh environment (`prisma migrate deploy` from scratch)
-- creates the same structures.

-- CreateEnum
CREATE TYPE "customer"."SettlementStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "customer"."ParkingSettlement" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCollected" INTEGER NOT NULL,
    "gupioCommission" INTEGER NOT NULL,
    "amountSettled" INTEGER NOT NULL,
    "status" "customer"."SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSettlement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer"."ParkingSettlement" ADD CONSTRAINT "ParkingSettlement_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "customer"."ParkingDealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "customer"."ParkingDealer" ADD COLUMN "commissionRate" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "customer"."ParkingBooking" ADD COLUMN "isSettled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer"."ParkingBooking" ADD COLUMN "settlementId" TEXT;
ALTER TABLE "customer"."ParkingBooking" ADD CONSTRAINT "ParkingBooking_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "customer"."ParkingSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "customer"."ParkingWalkIn" ADD COLUMN "isSettled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer"."ParkingWalkIn" ADD COLUMN "settlementId" TEXT;
ALTER TABLE "customer"."ParkingWalkIn" ADD CONSTRAINT "ParkingWalkIn_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "customer"."ParkingSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
