-- CreateEnum
CREATE TYPE "customer"."SOSStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "customer"."SOSType" AS ENUM ('MEDICAL', 'POLICE', 'MECHANICAL', 'ACCIDENT', 'OTHER');

-- AlterTable
ALTER TABLE "customer"."CustomerVehicle" ADD COLUMN "chassisNumber" TEXT,
ADD COLUMN "engineNumber" TEXT;

-- CreateTable
CREATE TABLE "customer"."ChatSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."DocumentEmbedding" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."TelematicsDevice" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "deviceToken" TEXT,
    "platform" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelematicsDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."DrivingTrip" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "durationMin" DOUBLE PRECISION NOT NULL,
    "maxSpeed" DOUBLE PRECISION,
    "avgSpeed" DOUBLE PRECISION,
    "fuelConsumed" DOUBLE PRECISION,
    "safetyScore" INTEGER NOT NULL,
    "startLocation" JSONB,
    "endLocation" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrivingTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."DrivingEvent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "severity" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrivingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."SOSRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "status" "customer"."SOSStatus" NOT NULL DEFAULT 'ACTIVE',
    "type" "customer"."SOSType" NOT NULL DEFAULT 'OTHER',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SOSRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."EmergencyContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "relation" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSession_customerId_idx" ON "customer"."ChatSession"("customerId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "customer"."ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "DocumentEmbedding_customerId_idx" ON "customer"."DocumentEmbedding"("customerId");

-- CreateIndex
CREATE INDEX "DocumentEmbedding_entityId_idx" ON "customer"."DocumentEmbedding"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TelematicsDevice_vehicleId_key" ON "customer"."TelematicsDevice"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "TelematicsDevice_instanceId_key" ON "customer"."TelematicsDevice"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "DrivingTrip_tripId_key" ON "customer"."DrivingTrip"("tripId");

-- CreateIndex
CREATE INDEX "DrivingTrip_vehicleId_idx" ON "customer"."DrivingTrip"("vehicleId");

-- CreateIndex
CREATE INDEX "DrivingTrip_startTime_idx" ON "customer"."DrivingTrip"("startTime");

-- CreateIndex
CREATE INDEX "DrivingEvent_tripId_idx" ON "customer"."DrivingEvent"("tripId");

-- CreateIndex
CREATE INDEX "SOSRequest_customerId_idx" ON "customer"."SOSRequest"("customerId");

-- CreateIndex
CREATE INDEX "SOSRequest_status_idx" ON "customer"."SOSRequest"("status");

-- CreateIndex
CREATE INDEX "EmergencyContact_customerId_idx" ON "customer"."EmergencyContact"("customerId");

-- AddForeignKey
ALTER TABLE "customer"."ChatSession" ADD CONSTRAINT "ChatSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "customer"."ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."TelematicsDevice" ADD CONSTRAINT "TelematicsDevice_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "customer"."CustomerVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."DrivingTrip" ADD CONSTRAINT "DrivingTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "customer"."CustomerVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."DrivingEvent" ADD CONSTRAINT "DrivingEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "customer"."DrivingTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."SOSRequest" ADD CONSTRAINT "SOSRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."EmergencyContact" ADD CONSTRAINT "EmergencyContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
