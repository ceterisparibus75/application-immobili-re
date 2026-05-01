-- CreateEnum
CREATE TYPE "LeaseTenantTransferType" AS ENUM (
  'CESSION_FONDS',
  'CESSION_DROIT_BAIL',
  'SUBSTITUTION',
  'FUSION_ABSORPTION',
  'AUTRE'
);

-- CreateTable
CREATE TABLE "LeaseTenantHistory" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "societyId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "transferType" "LeaseTenantTransferType",
  "transferReason" TEXT,
  "transferDocumentId" TEXT,

  CONSTRAINT "LeaseTenantHistory_pkey" PRIMARY KEY ("id")
);

-- Backfill current lease holders.
INSERT INTO "LeaseTenantHistory" (
  "id",
  "createdAt",
  "updatedAt",
  "societyId",
  "leaseId",
  "tenantId",
  "startDate",
  "endDate"
)
SELECT
  CONCAT('clth', substr(md5(random()::text || clock_timestamp()::text || l."id"), 1, 21)),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  l."societyId",
  l."id",
  l."tenantId",
  l."startDate",
  NULL
FROM "Lease" l
WHERE l."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "LeaseTenantHistory" h WHERE h."leaseId" = l."id"
  );

-- CreateIndex
CREATE INDEX "LeaseTenantHistory_societyId_idx" ON "LeaseTenantHistory"("societyId");
CREATE INDEX "LeaseTenantHistory_leaseId_idx" ON "LeaseTenantHistory"("leaseId");
CREATE INDEX "LeaseTenantHistory_tenantId_idx" ON "LeaseTenantHistory"("tenantId");
CREATE INDEX "LeaseTenantHistory_societyId_leaseId_startDate_idx" ON "LeaseTenantHistory"("societyId", "leaseId", "startDate");
CREATE INDEX "LeaseTenantHistory_leaseId_endDate_idx" ON "LeaseTenantHistory"("leaseId", "endDate");

-- AddForeignKey
ALTER TABLE "LeaseTenantHistory" ADD CONSTRAINT "LeaseTenantHistory_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaseTenantHistory" ADD CONSTRAINT "LeaseTenantHistory_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaseTenantHistory" ADD CONSTRAINT "LeaseTenantHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaseTenantHistory" ADD CONSTRAINT "LeaseTenantHistory_transferDocumentId_fkey" FOREIGN KEY ("transferDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
