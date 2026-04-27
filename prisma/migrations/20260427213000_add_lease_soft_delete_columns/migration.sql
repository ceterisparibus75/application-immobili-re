-- Hotfix production: la base existante avait ete baselinee sans ces colonnes.
-- Les colonnes sont nullable pour eviter toute reecriture ou migration de donnees.
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Lease" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Lease_societyId_deletedAt_idx" ON "Lease"("societyId", "deletedAt");
