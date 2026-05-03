-- CreateEnum
CREATE TYPE "ChargeStatementDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ChargeStatementDelivery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "regularizationId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sentById" TEXT,
    "fiscalYear" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "status" "ChargeStatementDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "pdfSha256" TEXT NOT NULL,
    "pdfSizeBytes" INTEGER NOT NULL,
    "evidence" JSONB,

    CONSTRAINT "ChargeStatementDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_regularizationId_idx" ON "ChargeStatementDelivery"("regularizationId");

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_societyId_idx" ON "ChargeStatementDelivery"("societyId");

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_tenantId_idx" ON "ChargeStatementDelivery"("tenantId");

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_leaseId_idx" ON "ChargeStatementDelivery"("leaseId");

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_sentById_idx" ON "ChargeStatementDelivery"("sentById");

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_societyId_fiscalYear_idx" ON "ChargeStatementDelivery"("societyId", "fiscalYear");

-- CreateIndex
CREATE INDEX "ChargeStatementDelivery_providerMessageId_idx" ON "ChargeStatementDelivery"("providerMessageId");

-- AddForeignKey
ALTER TABLE "ChargeStatementDelivery" ADD CONSTRAINT "ChargeStatementDelivery_regularizationId_fkey" FOREIGN KEY ("regularizationId") REFERENCES "ChargeRegularization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeStatementDelivery" ADD CONSTRAINT "ChargeStatementDelivery_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeStatementDelivery" ADD CONSTRAINT "ChargeStatementDelivery_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeStatementDelivery" ADD CONSTRAINT "ChargeStatementDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeStatementDelivery" ADD CONSTRAINT "ChargeStatementDelivery_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
