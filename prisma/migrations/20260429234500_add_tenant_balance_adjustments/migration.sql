-- CreateTable
CREATE TABLE "TenantBalanceAdjustment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "TenantBalanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantBalanceAdjustment_societyId_idx" ON "TenantBalanceAdjustment"("societyId");

-- CreateIndex
CREATE INDEX "TenantBalanceAdjustment_tenantId_idx" ON "TenantBalanceAdjustment"("tenantId");

-- CreateIndex
CREATE INDEX "TenantBalanceAdjustment_leaseId_idx" ON "TenantBalanceAdjustment"("leaseId");

-- CreateIndex
CREATE INDEX "TenantBalanceAdjustment_societyId_tenantId_idx" ON "TenantBalanceAdjustment"("societyId", "tenantId");

-- CreateIndex
CREATE INDEX "TenantBalanceAdjustment_societyId_dueDate_idx" ON "TenantBalanceAdjustment"("societyId", "dueDate");

-- AddForeignKey
ALTER TABLE "TenantBalanceAdjustment" ADD CONSTRAINT "TenantBalanceAdjustment_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBalanceAdjustment" ADD CONSTRAINT "TenantBalanceAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBalanceAdjustment" ADD CONSTRAINT "TenantBalanceAdjustment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
