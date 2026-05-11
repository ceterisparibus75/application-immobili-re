-- MyGestia — Exclusions ponctuelles de génération d'appels de loyers
-- À exécuter dans l'éditeur SQL Supabase.
-- Script idempotent : peut être relancé sans recréer les objets existants.

BEGIN;

CREATE TABLE IF NOT EXISTS "InvoiceGenerationExclusion" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "societyId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'Facturé dans un autre logiciel',
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "InvoiceGenerationExclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceGenerationExclusion_societyId_leaseId_periodStart_periodEnd_key"
  ON "InvoiceGenerationExclusion" ("societyId", "leaseId", "periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "InvoiceGenerationExclusion_societyId_periodStart_periodEnd_idx"
  ON "InvoiceGenerationExclusion" ("societyId", "periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "InvoiceGenerationExclusion_leaseId_idx"
  ON "InvoiceGenerationExclusion" ("leaseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceGenerationExclusion_societyId_fkey'
  ) THEN
    ALTER TABLE "InvoiceGenerationExclusion"
      ADD CONSTRAINT "InvoiceGenerationExclusion_societyId_fkey"
      FOREIGN KEY ("societyId")
      REFERENCES "Society" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceGenerationExclusion_leaseId_fkey'
  ) THEN
    ALTER TABLE "InvoiceGenerationExclusion"
      ADD CONSTRAINT "InvoiceGenerationExclusion_leaseId_fkey"
      FOREIGN KEY ("leaseId")
      REFERENCES "Lease" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
