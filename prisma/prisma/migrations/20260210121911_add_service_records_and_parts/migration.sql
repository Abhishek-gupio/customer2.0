-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'TOLL', 'PARKING', 'SERVICE', 'INSURANCE', 'CHALLAN', 'EMI', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'SMS', 'NOTIFICATION', 'VOICE', 'RECEIPT');

-- CreateEnum
CREATE TYPE "ServicePartType" AS ENUM ('ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'BRAKE_PADS', 'BRAKE_DISCS', 'BATTERY', 'TYRES_FRONT', 'TYRES_REAR', 'CLUTCH_PLATE', 'SPARK_PLUGS', 'COOLANT', 'TIMING_BELT', 'AC_FILTER', 'WIPER_BLADES', 'HEADLIGHT_BULB', 'OTHER_PART');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "category" "ExpenseCategory" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merchantName" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "receiptUrl" TEXT,
    "mimeType" TEXT,
    "rawText" TEXT,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseBudget" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'MONTHLY',
    "notifyThreshold" INTEGER NOT NULL DEFAULT 80,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelPriceCache" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'IOCL_API',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelPriceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "expenseId" TEXT,
    "serviceType" TEXT NOT NULL,
    "garageName" TEXT,
    "odometerAtService" INTEGER,
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceKm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePart" (
    "id" TEXT NOT NULL,
    "serviceRecordId" TEXT NOT NULL,
    "partType" "ServicePartType" NOT NULL,
    "partName" TEXT,
    "brand" TEXT,
    "cost" DOUBLE PRECISION,
    "warrantyMonths" INTEGER,
    "warrantyKm" INTEGER,
    "warrantyExpiresAt" TIMESTAMP(3),
    "lastReplacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReplacementDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_customerId_idx" ON "Expense"("customerId");

-- CreateIndex
CREATE INDEX "Expense_vehicleId_idx" ON "Expense"("vehicleId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseBudget_customerId_category_key" ON "ExpenseBudget"("customerId", "category");

-- CreateIndex
CREATE INDEX "FuelPriceCache_city_fuelType_idx" ON "FuelPriceCache"("city", "fuelType");

-- CreateIndex
CREATE UNIQUE INDEX "FuelPriceCache_city_fuelType_date_key" ON "FuelPriceCache"("city", "fuelType", "date");

-- CreateIndex
CREATE INDEX "ServiceRecord_vehicleId_idx" ON "ServiceRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "ServicePart_serviceRecordId_idx" ON "ServicePart"("serviceRecordId");

-- CreateIndex
CREATE INDEX "ServicePart_partType_idx" ON "ServicePart"("partType");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseBudget" ADD CONSTRAINT "ExpenseBudget_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePart" ADD CONSTRAINT "ServicePart_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "ServiceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
