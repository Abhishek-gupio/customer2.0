-- CreateIndex
CREATE INDEX "ParkingBooking_status_endTime_idx" ON "customer"."ParkingBooking"("status", "endTime");
