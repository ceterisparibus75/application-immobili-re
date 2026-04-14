-- ============================================================
-- Migration : module factures fournisseurs
-- Date      : 2026-04-14
-- Appliquer via : Supabase SQL Editor ou psql
-- ============================================================

-- ── 1. Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "SupplierInvoiceStatus" AS ENUM (
  'PENDING_REVIEW',
  'VALIDATED',
  'REJECTED',
  'PAID',
  'ARCHIVED'
);

CREATE TYPE "SupplierPaymentMethod" AS ENUM (
  'SEPA_XML',
  'QONTO',
  'MANUAL'
);

CREATE TYPE "SupplierPaymentStatus" AS ENUM (
  'PENDING',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'CANCELLED'
);

-- ── 2. SupplierInboxConfig ────────────────────────────────────────────────────
-- Une configuration de boîte mail entrante par société.

CREATE TABLE "SupplierInboxConfig" (
  "id"                TEXT          NOT NULL,
  "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)  NOT NULL,
  "societyId"         TEXT          NOT NULL,
  "inboxEmail"        TEXT          NOT NULL,
  "inboxSlug"         TEXT          NOT NULL,
  "isActive"          BOOLEAN       NOT NULL DEFAULT true,
  "webhookSecretHash" TEXT          NOT NULL,
  "notifyEmails"      TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],

  CONSTRAINT "SupplierInboxConfig_pkey" PRIMARY KEY ("id")
);

-- Contraintes d'unicité
CREATE UNIQUE INDEX "SupplierInboxConfig_societyId_key"  ON "SupplierInboxConfig"("societyId");
CREATE UNIQUE INDEX "SupplierInboxConfig_inboxEmail_key" ON "SupplierInboxConfig"("inboxEmail");
CREATE UNIQUE INDEX "SupplierInboxConfig_inboxSlug_key"  ON "SupplierInboxConfig"("inboxSlug");

-- Index de routage email entrant
CREATE INDEX "SupplierInboxConfig_inboxSlug_idx" ON "SupplierInboxConfig"("inboxSlug");

-- Clé étrangère
ALTER TABLE "SupplierInboxConfig"
  ADD CONSTRAINT "SupplierInboxConfig_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. SupplierInvoice ────────────────────────────────────────────────────────
-- Facture fournisseur reçue par email ou uploadée manuellement.

CREATE TABLE "SupplierInvoice" (
  "id"        TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "societyId" TEXT         NOT NULL,

  -- Statut & source
  "status"    "SupplierInvoiceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reference" TEXT,
  "source"    TEXT         NOT NULL DEFAULT 'manual_upload',

  -- Origine email (si inbound)
  "senderEmail"  TEXT,
  "emailSubject" TEXT,
  "receivedAt"   TIMESTAMP(3),

  -- Fichier PDF
  "fileName"    TEXT    NOT NULL,
  "fileUrl"     TEXT    NOT NULL,
  "storagePath" TEXT    NOT NULL,
  "fileSize"    INTEGER,
  "mimeType"    TEXT    NOT NULL DEFAULT 'application/pdf',

  -- Données extraites par IA (éditables)
  "supplierName"          TEXT,
  "supplierSiret"         TEXT,
  "supplierAddress"       TEXT,
  "supplierIbanEncrypted" TEXT,
  "supplierBic"           TEXT,
  "invoiceNumber"         TEXT,
  "invoiceDate"           TIMESTAMP(3),
  "dueDate"               TIMESTAMP(3),
  "amountHT"              DOUBLE PRECISION,
  "amountVAT"             DOUBLE PRECISION,
  "amountTTC"             DOUBLE PRECISION,
  "vatRate"               DOUBLE PRECISION,
  "currency"              TEXT NOT NULL DEFAULT 'EUR',
  "description"           TEXT,
  "periodStart"           TIMESTAMP(3),
  "periodEnd"             TIMESTAMP(3),

  -- Analyse IA
  "aiAnalyzedAt"  TIMESTAMP(3),
  "aiConfidence"  DOUBLE PRECISION,
  "aiRawMetadata" JSONB,
  "aiStatus"      TEXT NOT NULL DEFAULT 'pending',

  -- Tagging immeuble / bail / catégorie
  "buildingId" TEXT,
  "leaseId"    TEXT,
  "categoryId" TEXT,

  -- Objets créés à la validation
  "chargeId"       TEXT,
  "journalEntryId" TEXT,

  -- Paiement
  "paymentMethod"      "SupplierPaymentMethod",
  "paymentStatus"      "SupplierPaymentStatus",
  "paymentScheduledAt" TIMESTAMP(3),
  "paymentExecutedAt"  TIMESTAMP(3),
  "paymentReference"   TEXT,
  "bankAccountId"      TEXT,
  "sepaXmlUrl"         TEXT,
  "sepaXmlStoragePath" TEXT,
  "qontoTransferId"    TEXT,
  "bankJournalEntryId" TEXT,

  -- Rejet
  "rejectedAt"      TIMESTAMP(3),
  "rejectedBy"      TEXT,
  "rejectionReason" TEXT,

  -- Validation
  "validatedAt" TIMESTAMP(3),
  "validatedBy" TEXT,

  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- Contrainte d'unicité (1 charge max par facture fournisseur)
CREATE UNIQUE INDEX "SupplierInvoice_chargeId_key" ON "SupplierInvoice"("chargeId");

-- Index
CREATE INDEX "SupplierInvoice_societyId_idx"           ON "SupplierInvoice"("societyId");
CREATE INDEX "SupplierInvoice_societyId_status_idx"    ON "SupplierInvoice"("societyId", "status");
CREATE INDEX "SupplierInvoice_societyId_createdAt_idx" ON "SupplierInvoice"("societyId", "createdAt");
CREATE INDEX "SupplierInvoice_buildingId_idx"          ON "SupplierInvoice"("buildingId");
CREATE INDEX "SupplierInvoice_leaseId_idx"             ON "SupplierInvoice"("leaseId");
CREATE INDEX "SupplierInvoice_supplierName_idx"        ON "SupplierInvoice"("supplierName");
CREATE INDEX "SupplierInvoice_invoiceDate_idx"         ON "SupplierInvoice"("invoiceDate");

-- Clés étrangères
ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_leaseId_fkey"
  FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ChargeCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_chargeId_fkey"
  FOREIGN KEY ("chargeId") REFERENCES "Charge"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
  ADD CONSTRAINT "SupplierInvoice_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
