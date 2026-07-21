-- CreateEnum
CREATE TYPE "customer"."ParkingPaymentMethod" AS ENUM ('CASH', 'ONLINE');

-- AlterTable
ALTER TABLE "customer"."ParkingWalkIn" ADD COLUMN "paymentMethod" "customer"."ParkingPaymentMethod";
ALTER TABLE "customer"."ParkingWalkIn" ALTER COLUMN "amountPaise" SET DEFAULT 0;
