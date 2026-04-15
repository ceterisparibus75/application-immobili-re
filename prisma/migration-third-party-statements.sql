-- ============================================================
-- Migration : module relevés tiers (ThirdPartyStatement)
-- Date      : 2026-04-15
-- Appliquer via : Supabase SQL Editor ou psql
-- ============================================================

-- ── 1. Enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "StatementType" AS ENUM (
    'APPEL_FONDS',
    'DECOMPTE_CHARGES',
    'DECOMPTE_GESTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatementStatus" AS ENUM (
    'BROUILLON',
    'VALIDE',
    'PAYE',
    'PARTIELLEMENT_PAYE',
    'REGULARISE',
    'VERIFIE',
    'CONFORME',
    'LITIGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. ThirdPartyStatement ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ThirdPartyStatement" (
  "id"          TEXT          NOT NULL,
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "societyId"   TEXT          NOT NULL,

  -- Contexte
  "buildingId"  TEXT,
  "leaseId"     TEXT,
  "type"        "StatementType"   NOT NULL,
  "status"      "StatementStatus" NOT NULL DEFAULT 'BROUILLON',

  -- Tiers
  "thirdPartyName" TEXT NOT NULL,
  "contactId"      TEXT,

  -- Identification
  "reference"    TEXT,
  "periodStart"  TIMESTAMP(3) NOT NULL,
  "periodEnd"    TIMESTAMP(3) NOT NULL,
  "periodLabel"  TEXT,

  -- Dates
  "receivedDate" TIMESTAMP(3) NOT NULL,
  "dueDate"      TIMESTAMP(3),
  "paidAt"       TIMESTAMP(3),

  -- Montants
  "totalAmount"  DOUBLE PRECISION NOT NULL,
  "paidAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netAmount"    DOUBLE PRECISION,

  -- Paiement
  "paymentMethod"    TEXT,
  "paymentReference" TEXT,

  -- Document source
  "documentId"   TEXT,
  "aiExtracted"  BOOLEAN NOT NULL DEFAULT false,
  "aiConfidence" DOUBLE PRECISION,

  -- Vérification (gestion locative)
  "verificationResult" JSONB,
  "verificationStatus" TEXT,

  -- Notes
  "notes" TEXT,

  CONSTRAINT "ThirdPartyStatement_pkey" PRIMARY KEY ("id")
);

-- Unicité documentId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'ThirdPartyStatement_documentId_key'
  ) THEN
    CREATE UNIQUE INDEX "ThirdPartyStatement_documentId_key" ON "ThirdPartyStatement"("documentId")
      WHERE "documentId" IS NOT NULL;
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS "ThirdPartyStatement_societyId_idx"
  ON "ThirdPartyStatement"("societyId");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatement_buildingId_idx"
  ON "ThirdPartyStatement"("buildingId");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatement_leaseId_idx"
  ON "ThirdPartyStatement"("leaseId");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatement_societyId_type_idx"
  ON "ThirdPartyStatement"("societyId", "type");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatement_societyId_status_idx"
  ON "ThirdPartyStatement"("societyId", "status");

-- Clés étrangères
DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatement"
    ADD CONSTRAINT "ThirdPartyStatement_societyId_fkey"
    FOREIGN KEY ("societyId") REFERENCES "Society"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatement"
    ADD CONSTRAINT "ThirdPartyStatement_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatement"
    ADD CONSTRAINT "ThirdPartyStatement_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatement"
    ADD CONSTRAINT "ThirdPartyStatement_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatement"
    ADD CONSTRAINT "ThirdPartyStatement_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. ThirdPartyStatementLine ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ThirdPartyStatementLine" (
  "id"          TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "leaseId"     TEXT,

  "lineType"    TEXT             NOT NULL,
  "label"       TEXT             NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "categoryId"  TEXT,
  "nature"      TEXT,
  "recoverableRate" DOUBLE PRECISION,

  -- Vérification
  "expectedAmount"     DOUBLE PRECISION,
  "verificationStatus" TEXT,

  CONSTRAINT "ThirdPartyStatementLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ThirdPartyStatementLine_statementId_idx"
  ON "ThirdPartyStatementLine"("statementId");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatementLine_leaseId_idx"
  ON "ThirdPartyStatementLine"("leaseId");

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatementLine"
    ADD CONSTRAINT "ThirdPartyStatementLine_statementId_fkey"
    FOREIGN KEY ("statementId") REFERENCES "ThirdPartyStatement"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatementLine"
    ADD CONSTRAINT "ThirdPartyStatementLine_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. ThirdPartyStatementLease ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ThirdPartyStatementLease" (
  "id"          TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "leaseId"     TEXT NOT NULL,

  -- Montants ventilés par bail
  "rentAmount"       DOUBLE PRECISION,
  "provisionAmount"  DOUBLE PRECISION,
  "feeAmount"        DOUBLE PRECISION,
  "deductionAmount"  DOUBLE PRECISION,
  "netAmount"        DOUBLE PRECISION,

  CONSTRAINT "ThirdPartyStatementLease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ThirdPartyStatementLease_statementId_leaseId_key"
  ON "ThirdPartyStatementLease"("statementId", "leaseId");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatementLease_statementId_idx"
  ON "ThirdPartyStatementLease"("statementId");
CREATE INDEX IF NOT EXISTS "ThirdPartyStatementLease_leaseId_idx"
  ON "ThirdPartyStatementLease"("leaseId");

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatementLease"
    ADD CONSTRAINT "ThirdPartyStatementLease_statementId_fkey"
    FOREIGN KEY ("statementId") REFERENCES "ThirdPartyStatement"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ThirdPartyStatementLease"
    ADD CONSTRAINT "ThirdPartyStatementLease_leaseId_fkey"
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. Colonnes ajoutées aux tables existantes ────────────────────────────────

-- Charge.statementId
ALTER TABLE "Charge" ADD COLUMN IF NOT EXISTS "statementId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Charge"
    ADD CONSTRAINT "Charge_statementId_fkey"
    FOREIGN KEY ("statementId") REFERENCES "ThirdPartyStatement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Charge_statementId_idx" ON "Charge"("statementId");

-- ChargeRegularization : nouvelles colonnes
ALTER TABLE "ChargeRegularization"
  ADD COLUMN IF NOT EXISTS "statementFileUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "isFinalized"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "finalizedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceStatementId" TEXT;

DO $$ BEGIN
  ALTER TABLE "ChargeRegularization"
    ADD CONSTRAINT "ChargeRegularization_sourceStatementId_fkey"
    FOREIGN KEY ("sourceStatementId") REFERENCES "ThirdPartyStatement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BankReconciliation.statementId
ALTER TABLE "BankReconciliation" ADD COLUMN IF NOT EXISTS "statementId" TEXT;

DO $$ BEGIN
  ALTER TABLE "BankReconciliation"
    ADD CONSTRAINT "BankReconciliation_statementId_fkey"
    FOREIGN KEY ("statementId") REFERENCES "ThirdPartyStatement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "BankReconciliation_statementId_idx"
  ON "BankReconciliation"("statementId");
