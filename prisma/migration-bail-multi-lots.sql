-- Migration : Support bail multi-lots (un bail peut couvrir plusieurs lots)
-- Date : 2026-04-11

-- ============================================================
-- 1. Créer la table de liaison LeaseLot
-- ============================================================
CREATE TABLE IF NOT EXISTS "LeaseLot" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LeaseLot_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. Migrer les données existantes : chaque bail existant
--    a son lotId copié dans LeaseLot avec isPrimary = true
-- ============================================================
INSERT INTO "LeaseLot" ("id", "createdAt", "leaseId", "lotId", "isPrimary")
SELECT
  gen_random_uuid()::text,
  NOW(),
  l."id",
  l."lotId",
  true
FROM "Lease" l
WHERE l."lotId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Contraintes de clé étrangère
-- ============================================================
ALTER TABLE "LeaseLot" ADD CONSTRAINT "LeaseLot_leaseId_fkey"
  FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaseLot" ADD CONSTRAINT "LeaseLot_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. Contrainte d'unicité (un lot ne peut apparaître qu'une
--    fois dans le même bail)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "LeaseLot_leaseId_lotId_key"
  ON "LeaseLot"("leaseId", "lotId");

-- ============================================================
-- 5. Index de performance
-- ============================================================
CREATE INDEX IF NOT EXISTS "LeaseLot_leaseId_idx" ON "LeaseLot"("leaseId");
CREATE INDEX IF NOT EXISTS "LeaseLot_lotId_idx" ON "LeaseLot"("lotId");
