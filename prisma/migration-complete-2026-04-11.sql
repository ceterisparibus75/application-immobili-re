-- ================================================================
-- MIGRATION COMPLETE — 11 avril 2026
-- Exécuter dans Supabase SQL Editor en une seule fois
-- ================================================================
-- Contenu :
--   A. Bail multi-lots (LeaseLot)
--   B. Paliers de loyer (LeaseRentStep)
--   C. Émissions obligataires + Comptes courants d'associé
-- ================================================================

BEGIN;

-- ============================================================
-- A. BAIL MULTI-LOTS
-- ============================================================

-- A1. Table de liaison LeaseLot
CREATE TABLE IF NOT EXISTS "LeaseLot" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LeaseLot_pkey" PRIMARY KEY ("id")
);

-- A2. Migrer les baux existants (chaque bail a son lotId copié avec isPrimary = true)
INSERT INTO "LeaseLot" ("id", "createdAt", "leaseId", "lotId", "isPrimary")
SELECT
  gen_random_uuid()::text,
  NOW(),
  l."id",
  l."lotId",
  true
FROM "Lease" l
WHERE l."lotId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "LeaseLot" ll WHERE ll."leaseId" = l."id" AND ll."lotId" = l."lotId"
  );

-- A3. Clés étrangères
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaseLot_leaseId_fkey') THEN
    ALTER TABLE "LeaseLot" ADD CONSTRAINT "LeaseLot_leaseId_fkey"
      FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaseLot_lotId_fkey') THEN
    ALTER TABLE "LeaseLot" ADD CONSTRAINT "LeaseLot_lotId_fkey"
      FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- A4. Index
CREATE UNIQUE INDEX IF NOT EXISTS "LeaseLot_leaseId_lotId_key" ON "LeaseLot"("leaseId", "lotId");
CREATE INDEX IF NOT EXISTS "LeaseLot_leaseId_idx" ON "LeaseLot"("leaseId");
CREATE INDEX IF NOT EXISTS "LeaseLot_lotId_idx" ON "LeaseLot"("lotId");

-- ============================================================
-- B. PALIERS DE LOYER (LeaseRentStep)
-- ============================================================

CREATE TABLE IF NOT EXISTS "LeaseRentStep" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseId"   TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3),
    "rentHT"    DOUBLE PRECISION NOT NULL,
    "chargesHT" DOUBLE PRECISION,
    "position"  INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeaseRentStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeaseRentStep_leaseId_idx" ON "LeaseRentStep"("leaseId");
CREATE INDEX IF NOT EXISTS "LeaseRentStep_leaseId_startDate_idx" ON "LeaseRentStep"("leaseId", "startDate");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeaseRentStep_leaseId_fkey') THEN
    ALTER TABLE "LeaseRentStep"
      ADD CONSTRAINT "LeaseRentStep_leaseId_fkey"
      FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- C1. TYPES D'EMPRUNT : OBLIGATION + COMPTE_COURANT
-- ============================================================

ALTER TYPE "LoanType" ADD VALUE IF NOT EXISTS 'OBLIGATION';
ALTER TYPE "LoanType" ADD VALUE IF NOT EXISTS 'COMPTE_COURANT';

COMMIT;

-- Les ALTER TYPE ADD VALUE ne peuvent pas être dans une transaction
-- On démarre une nouvelle transaction pour le reste

BEGIN;

-- ============================================================
-- C2. ENUM CouponFrequency
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponFrequency') THEN
        CREATE TYPE "CouponFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL');
    END IF;
END $$;

-- ============================================================
-- C3. ENUM LoanMovementType
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanMovementType') THEN
        CREATE TYPE "LoanMovementType" AS ENUM ('APPORT', 'RETRAIT', 'INTERETS');
    END IF;
END $$;

-- ============================================================
-- C4. CHAMPS SPÉCIFIQUES SUR LE MODÈLE LOAN
-- ============================================================

-- Champs Émission obligataire
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "nominalValue"    DOUBLE PRECISION;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "bondCount"       INTEGER;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "couponFrequency" "CouponFrequency";
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "issuePrice"      DOUBLE PRECISION;

-- Champs Compte courant d'associé
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "partnerName"    TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "partnerShare"   DOUBLE PRECISION;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "maxAmount"      DOUBLE PRECISION;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "conventionDate" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "currentBalance" DOUBLE PRECISION DEFAULT 0;

-- ============================================================
-- C5. TABLE LoanMovement (mouvements compte courant)
-- ============================================================

CREATE TABLE IF NOT EXISTS "LoanMovement" (
    "id"           TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loanId"       TEXT NOT NULL,
    "date"         TIMESTAMP(3) NOT NULL,
    "type"         "LoanMovementType" NOT NULL,
    "amount"       DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description"  TEXT,

    CONSTRAINT "LoanMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoanMovement_loanId_idx" ON "LoanMovement"("loanId");
CREATE INDEX IF NOT EXISTS "LoanMovement_loanId_date_idx" ON "LoanMovement"("loanId", "date");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoanMovement_loanId_fkey') THEN
    ALTER TABLE "LoanMovement"
      ADD CONSTRAINT "LoanMovement_loanId_fkey"
      FOREIGN KEY ("loanId") REFERENCES "Loan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
