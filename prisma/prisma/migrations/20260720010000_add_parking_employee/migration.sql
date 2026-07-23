-- CreateTable
CREATE TABLE "customer"."ParkingEmployee" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParkingEmployee_phoneNumber_key" ON "customer"."ParkingEmployee"("phoneNumber");

-- CreateIndex
CREATE INDEX "ParkingEmployee_dealerId_idx" ON "customer"."ParkingEmployee"("dealerId");

-- AddForeignKey
ALTER TABLE "customer"."ParkingEmployee" ADD CONSTRAINT "ParkingEmployee_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "customer"."ParkingDealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
