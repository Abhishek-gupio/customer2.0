-- NOTE: ParkingSettlement table, ParkingBooking.isSettled/settlementId, and
-- ParkingWalkIn.isSettled/settlementId/paymentMethod columns, and
-- ParkingDealer.commissionRate were already applied directly to this shared
-- DB outside of prisma migrate (confirmed via psql before writing this file).
-- This migration only adds the pieces that were still missing so the DB
-- fully matches schema.prisma and `_prisma_migrations` stays accurate.

-- AlterEnum
ALTER TYPE "customer"."ExpenseCategory" ADD VALUE IF NOT EXISTS 'REPAIR';

-- AlterEnum
ALTER TYPE "customer"."ExpenseSource" ADD VALUE IF NOT EXISTS 'UPI';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParkingBooking_isSettled_idx" ON "customer"."ParkingBooking"("isSettled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParkingSettlement_dealerId_date_idx" ON "customer"."ParkingSettlement"("dealerId", "date");
