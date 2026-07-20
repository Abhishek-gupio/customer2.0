-- CreateEnum
CREATE TYPE "customer"."PaymentPurpose" AS ENUM ('PARKING_BOOKING');

-- CreateEnum
CREATE TYPE "customer"."OrderStatus" AS ENUM ('CREATED', 'ATTEMPTED', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "customer"."PaymentAttemptStatus" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "customer"."CustomerRefundStatus" AS ENUM ('INITIATED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "customer"."DealerStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "customer"."ListingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "customer"."BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "customer"."CustomerOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purpose" "customer"."PaymentPurpose" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "customer"."OrderStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."CustomerPaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "method" TEXT,
    "status" "customer"."PaymentAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."CustomerRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "customer"."CustomerRefundStatus" NOT NULL DEFAULT 'INITIATED',
    "razorpayRefundId" TEXT,
    "reason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "eventType" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."ParkingDealer" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "customer"."DealerStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingDealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."ParkingListing" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "fourWheelerCapacity" INTEGER NOT NULL DEFAULT 0,
    "twoWheelerCapacity" INTEGER NOT NULL DEFAULT 0,
    "hourlyRatePaise" INTEGER NOT NULL,
    "dailyRatePaise" INTEGER,
    "photos" TEXT[],
    "status" "customer"."ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."ParkingSlotWindow" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startHour" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParkingSlotWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."ParkingBooking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "slotWindowId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "customer"."BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer"."ParkingWaitlistEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "desiredDate" DATE NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_razorpayOrderId_key" ON "customer"."CustomerOrder"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "CustomerOrder_customerId_idx" ON "customer"."CustomerOrder"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOrder_referenceId_idx" ON "customer"."CustomerOrder"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPaymentAttempt_razorpayPaymentId_key" ON "customer"."CustomerPaymentAttempt"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "CustomerPaymentAttempt_orderId_idx" ON "customer"."CustomerPaymentAttempt"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_razorpayRefundId_key" ON "customer"."CustomerRefund"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "CustomerRefund_orderId_idx" ON "customer"."CustomerRefund"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "customer"."WebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "customer"."WebhookEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingDealer_phoneNumber_key" ON "customer"."ParkingDealer"("phoneNumber");

-- CreateIndex
CREATE INDEX "ParkingListing_dealerId_idx" ON "customer"."ParkingListing"("dealerId");

-- CreateIndex
CREATE INDEX "ParkingListing_latitude_longitude_idx" ON "customer"."ParkingListing"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "ParkingSlotWindow_listingId_date_idx" ON "customer"."ParkingSlotWindow"("listingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlotWindow_listingId_date_startHour_key" ON "customer"."ParkingSlotWindow"("listingId", "date", "startHour");

-- CreateIndex
CREATE INDEX "ParkingBooking_customerId_idx" ON "customer"."ParkingBooking"("customerId");

-- CreateIndex
CREATE INDEX "ParkingBooking_listingId_startTime_idx" ON "customer"."ParkingBooking"("listingId", "startTime");

-- CreateIndex
CREATE INDEX "ParkingBooking_status_createdAt_idx" ON "customer"."ParkingBooking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ParkingWaitlistEntry_listingId_desiredDate_idx" ON "customer"."ParkingWaitlistEntry"("listingId", "desiredDate");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingWaitlistEntry_listingId_customerId_desiredDate_key" ON "customer"."ParkingWaitlistEntry"("listingId", "customerId", "desiredDate");

-- AddForeignKey
ALTER TABLE "customer"."CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."CustomerPaymentAttempt" ADD CONSTRAINT "CustomerPaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "customer"."CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."CustomerRefund" ADD CONSTRAINT "CustomerRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "customer"."CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingListing" ADD CONSTRAINT "ParkingListing_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "customer"."ParkingDealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingSlotWindow" ADD CONSTRAINT "ParkingSlotWindow_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "customer"."ParkingListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingBooking" ADD CONSTRAINT "ParkingBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingBooking" ADD CONSTRAINT "ParkingBooking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "customer"."ParkingListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingWaitlistEntry" ADD CONSTRAINT "ParkingWaitlistEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer"."ParkingWaitlistEntry" ADD CONSTRAINT "ParkingWaitlistEntry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "customer"."ParkingListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "customer"."ParkingBooking" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ParkingBooking_idempotencyKey_key" ON "customer"."ParkingBooking"("idempotencyKey");

