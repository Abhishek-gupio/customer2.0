-- CreateEnum
CREATE TYPE "customer"."VehicleAssetType" AS ENUM ('HERO', 'ANGLE');

-- CreateTable
CREATE TABLE "customer"."VehicleCatalog" (
    "id" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "normalizedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."VehicleAsset" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "type" "customer"."VehicleAssetType" NOT NULL,
    "assetIndex" INTEGER NOT NULL DEFAULT 0,
    "assetUrl" TEXT NOT NULL,
    "assetHash" TEXT,
    "mimeType" TEXT,
    "s3Key" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalog_normalizedKey_key" ON "customer"."VehicleCatalog"("normalizedKey");

-- CreateIndex
CREATE INDEX "VehicleCatalog_vehicleType_idx" ON "customer"."VehicleCatalog"("vehicleType");

-- CreateIndex
CREATE INDEX "VehicleCatalog_make_idx" ON "customer"."VehicleCatalog"("make");

-- CreateIndex
CREATE INDEX "VehicleCatalog_model_idx" ON "customer"."VehicleCatalog"("model");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleAsset_catalogId_type_assetIndex_key" ON "customer"."VehicleAsset"("catalogId", "type", "assetIndex");

-- CreateIndex
CREATE INDEX "VehicleAsset_catalogId_type_idx" ON "customer"."VehicleAsset"("catalogId", "type");

-- AddForeignKey
ALTER TABLE "customer"."VehicleAsset" ADD CONSTRAINT "VehicleAsset_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "customer"."VehicleCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

