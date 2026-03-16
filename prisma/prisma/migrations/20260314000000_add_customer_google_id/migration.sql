-- AlterTable
ALTER TABLE "customer"."Customer" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_googleId_key" ON "customer"."Customer"("googleId");
