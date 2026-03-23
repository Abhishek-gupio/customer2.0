-- CreateTable
CREATE TABLE "PartReplacementInterval" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT,
    "yearMin" INTEGER,
    "yearMax" INTEGER,
    "partType" "ServicePartType" NOT NULL,
    "intervalMonths" INTEGER NOT NULL,
    "intervalKm" INTEGER NOT NULL,
    "defaultWarrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartReplacementInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartReplacementInterval_make_model_yearMin_yearMax_partType_key" ON "PartReplacementInterval"("make", "model", "yearMin", "yearMax", "partType");

-- CreateIndex
CREATE INDEX "PartReplacementInterval_partType_idx" ON "PartReplacementInterval"("partType");

-- CreateIndex
CREATE INDEX "PartReplacementInterval_make_model_idx" ON "PartReplacementInterval"("make", "model");
