-- Immobilisations et dotations d'amortissement pour l'activité immobilière.
CREATE TYPE "FixedAssetCategory" AS ENUM (
  'STRUCTURE',
  'FACADE_TOITURE',
  'INSTALLATIONS_TECHNIQUES',
  'AGENCEMENTS_AMENAGEMENTS',
  'MOBILIER_EQUIPEMENTS',
  'TRAVAUX_COPROPRIETE',
  'AUTRE'
);

CREATE TYPE "FixedAssetDepreciationMethod" AS ENUM ('LINEAR');

CREATE TYPE "FixedAssetStatus" AS ENUM (
  'ACTIVE',
  'FULLY_DEPRECIATED',
  'DISPOSED',
  'ARCHIVED'
);

CREATE TYPE "FixedAssetDepreciationLineStatus" AS ENUM (
  'PLANNED',
  'POSTED',
  'SKIPPED'
);

CREATE TABLE "FixedAsset" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "societyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "FixedAssetCategory" NOT NULL DEFAULT 'AUTRE',
  "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "method" "FixedAssetDepreciationMethod" NOT NULL DEFAULT 'LINEAR',
  "buildingId" TEXT NOT NULL,
  "supplierInvoiceId" TEXT,
  "acquisitionJournalEntryId" TEXT,
  "assetAccountId" TEXT NOT NULL,
  "depreciationAccountId" TEXT NOT NULL,
  "expenseAccountId" TEXT NOT NULL,
  "acquisitionDate" TIMESTAMP(3) NOT NULL,
  "serviceStartDate" TIMESTAMP(3) NOT NULL,
  "depreciableBase" DOUBLE PRECISION NOT NULL,
  "residualValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "durationMonths" INTEGER NOT NULL,
  CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FixedAssetDepreciationLine" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "fixedAssetId" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "fiscalYear" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "accumulatedAmount" DOUBLE PRECISION NOT NULL,
  "netBookValue" DOUBLE PRECISION NOT NULL,
  "status" "FixedAssetDepreciationLineStatus" NOT NULL DEFAULT 'PLANNED',
  CONSTRAINT "FixedAssetDepreciationLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FixedAsset_societyId_idx" ON "FixedAsset"("societyId");
CREATE INDEX "FixedAsset_societyId_status_idx" ON "FixedAsset"("societyId", "status");
CREATE INDEX "FixedAsset_buildingId_idx" ON "FixedAsset"("buildingId");
CREATE INDEX "FixedAsset_supplierInvoiceId_idx" ON "FixedAsset"("supplierInvoiceId");

CREATE INDEX "FixedAssetDepreciationLine_fixedAssetId_idx" ON "FixedAssetDepreciationLine"("fixedAssetId");
CREATE INDEX "FixedAssetDepreciationLine_journalEntryId_idx" ON "FixedAssetDepreciationLine"("journalEntryId");
CREATE INDEX "FixedAssetDepreciationLine_fiscalYear_idx" ON "FixedAssetDepreciationLine"("fiscalYear");
CREATE UNIQUE INDEX "FixedAssetDepreciationLine_fixedAssetId_fiscalYear_key"
  ON "FixedAssetDepreciationLine"("fixedAssetId", "fiscalYear");

ALTER TABLE "FixedAsset"
  ADD CONSTRAINT "FixedAsset_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAsset_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAsset_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAsset_acquisitionJournalEntryId_fkey" FOREIGN KEY ("acquisitionJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAsset_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAsset_depreciationAccountId_fkey" FOREIGN KEY ("depreciationAccountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAsset_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FixedAssetDepreciationLine"
  ADD CONSTRAINT "FixedAssetDepreciationLine_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FixedAssetDepreciationLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
