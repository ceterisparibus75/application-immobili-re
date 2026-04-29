-- AlterTable
ALTER TABLE "TenantBalanceAdjustment"
ADD COLUMN "reference" TEXT,
ADD COLUMN "periodLabel" TEXT,
ADD COLUMN "periodStart" TIMESTAMP(3),
ADD COLUMN "periodEnd" TIMESTAMP(3),
ADD COLUMN "balanceAfter" DOUBLE PRECISION,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX "TenantBalanceAdjustment_importBatchId_idx" ON "TenantBalanceAdjustment"("importBatchId");
