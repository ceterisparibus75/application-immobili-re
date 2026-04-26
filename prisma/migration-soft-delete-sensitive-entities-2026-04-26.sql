-- Soft delete des entites sensibles conservees pour audit/RGPD/comptabilite.
-- A executer avant le deploiement du code qui filtre deletedAt IS NULL.

ALTER TABLE "Lease"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Lease_societyId_deletedAt_idx"
  ON "Lease"("societyId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Tenant_societyId_deletedAt_idx"
  ON "Tenant"("societyId", "deletedAt");

CREATE INDEX IF NOT EXISTS "Document_societyId_deletedAt_idx"
  ON "Document"("societyId", "deletedAt");
