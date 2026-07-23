-- CreateTable
CREATE TABLE "customer"."ParkingEmployeeListing" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingEmployeeListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParkingEmployeeListing_employeeId_listingId_key" ON "customer"."ParkingEmployeeListing"("employeeId", "listingId");

-- CreateIndex
CREATE INDEX "ParkingEmployeeListing_listingId_idx" ON "customer"."ParkingEmployeeListing"("listingId");

-- AddForeignKey
ALTER TABLE "customer"."ParkingEmployeeListing" ADD CONSTRAINT "ParkingEmployeeListing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "customer"."ParkingEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingEmployeeListing" ADD CONSTRAINT "ParkingEmployeeListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "customer"."ParkingListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
