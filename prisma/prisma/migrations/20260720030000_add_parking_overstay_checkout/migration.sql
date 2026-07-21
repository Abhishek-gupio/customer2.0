-- AlterEnum
ALTER TYPE "customer"."PaymentPurpose" ADD VALUE 'PARKING_EXTRA_CHARGE';

-- AlterTable
ALTER TABLE "customer"."ParkingBooking" ADD COLUMN "actualCheckOutTime" TIMESTAMP(3);
ALTER TABLE "customer"."ParkingBooking" ADD COLUMN "extraAmountPaise" INTEGER;
ALTER TABLE "customer"."ParkingBooking" ADD COLUMN "extraOrderId" TEXT;
