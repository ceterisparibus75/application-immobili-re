-- Complete le hotfix soft-delete pour les tables existantes en production.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Tenant_societyId_deletedAt_idx" ON "Tenant"("societyId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Document_societyId_deletedAt_idx" ON "Document"("societyId", "deletedAt");
