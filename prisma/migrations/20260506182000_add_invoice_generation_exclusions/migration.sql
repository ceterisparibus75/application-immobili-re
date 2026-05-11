-- CreateTable
CREATE TABLE "InvoiceGenerationExclusion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'Facturé dans un autre logiciel',
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "InvoiceGenerationExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceGenerationExclusion_societyId_leaseId_periodStart_periodEnd_key" ON "InvoiceGenerationExclusion"("societyId", "leaseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "InvoiceGenerationExclusion_societyId_periodStart_periodEnd_idx" ON "InvoiceGenerationExclusion"("societyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "InvoiceGenerationExclusion_leaseId_idx" ON "InvoiceGenerationExclusion"("leaseId");

-- AddForeignKey
ALTER TABLE "InvoiceGenerationExclusion" ADD CONSTRAINT "InvoiceGenerationExclusion_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceGenerationExclusion" ADD CONSTRAINT "InvoiceGenerationExclusion_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
