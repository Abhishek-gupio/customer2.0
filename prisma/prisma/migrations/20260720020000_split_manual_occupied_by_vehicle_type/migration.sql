-- AlterTable: split manualOccupied into per-vehicle-type counters
ALTER TABLE "customer"."ParkingSlotWindow" ADD COLUMN "manualOccupiedCars" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customer"."ParkingSlotWindow" ADD COLUMN "manualOccupiedBikes" INTEGER NOT NULL DEFAULT 0;

UPDATE "customer"."ParkingSlotWindow" SET "manualOccupiedCars" = "manualOccupied";

ALTER TABLE "customer"."ParkingSlotWindow" DROP COLUMN "manualOccupied";
