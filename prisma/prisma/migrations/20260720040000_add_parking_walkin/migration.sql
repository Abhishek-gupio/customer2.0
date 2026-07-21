-- CreateEnum
CREATE TYPE "customer"."ParkingVehicleType" AS ENUM ('CAR', 'BIKE');

-- CreateTable
CREATE TABLE "customer"."ParkingWalkIn" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "slotWindowId" TEXT NOT NULL,
    "vehicleType" "customer"."ParkingVehicleType" NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "employeeId" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),

    CONSTRAINT "ParkingWalkIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParkingWalkIn_listingId_exitedAt_idx" ON "customer"."ParkingWalkIn"("listingId", "exitedAt");

-- CreateIndex
CREATE INDEX "ParkingWalkIn_slotWindowId_idx" ON "customer"."ParkingWalkIn"("slotWindowId");

-- AddForeignKey
ALTER TABLE "customer"."ParkingWalkIn" ADD CONSTRAINT "ParkingWalkIn_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "customer"."ParkingListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingWalkIn" ADD CONSTRAINT "ParkingWalkIn_slotWindowId_fkey" FOREIGN KEY ("slotWindowId") REFERENCES "customer"."ParkingSlotWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingWalkIn" ADD CONSTRAINT "ParkingWalkIn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "customer"."ParkingEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
