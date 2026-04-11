-- Migration : Paliers de loyer + Émissions obligataires + Comptes courants d'associé
-- À exécuter sur Supabase (SQL Editor) après le déploiement

-- ============================================================
-- 1. PALIERS DE LOYER (LeaseRentStep)
-- ============================================================

-- Enum non nécessaire (pas de nouveau type enum pour les paliers)

CREATE TABLE IF NOT EXISTS "LeaseRentStep" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseId"   TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3),
    "rentHT"    DOUBLE PRECISION NOT NULL,
    "chargesHT" DOUBLE PRECISION,
    "position"  INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeaseRentStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaseRentStep_leaseId_idx" ON "LeaseRentStep"("leaseId");
CREATE INDEX "LeaseRentStep_leaseId_startDate_idx" ON "LeaseRentStep"("leaseId", "startDate");

ALTER TABLE "LeaseRentStep"
    ADD CONSTRAINT "LeaseRentStep_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 2. TYPES D'EMPRUNT : OBLIGATION + COMPTE_COURANT
-- ============================================================

-- Ajouter les nouvelles valeurs à l'enum LoanType
ALTER TYPE "LoanType" ADD VALUE IF NOT EXISTS 'OBLIGATION';
ALTER TYPE "LoanType" ADD VALUE IF NOT EXISTS 'COMPTE_COURANT';

-- Ajouter l'enum CouponFrequency
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponFrequency') THEN
        CREATE TYPE "CouponFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL');
    END IF;
END $$;

-- Ajouter l'enum LoanMovementType
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanMovementType') THEN
        CREATE TYPE "LoanMovementType" AS ENUM ('APPORT', 'RETRAIT', 'INTERETS');
    END IF;
END $$;

-- ============================================================
-- 3. CHAMPS SPÉCIFIQUES SUR LE MODÈLE LOAN
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
-- 4. TABLE LoanMovement (mouvements compte courant)
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

CREATE INDEX "LoanMovement_loanId_idx" ON "LoanMovement"("loanId");
CREATE INDEX "LoanMovement_loanId_date_idx" ON "LoanMovement"("loanId", "date");

ALTER TABLE "LoanMovement"
    ADD CONSTRAINT "LoanMovement_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "Loan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
