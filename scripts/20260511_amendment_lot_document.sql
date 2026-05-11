-- MyGestia — Avenant lots + lien document GED
-- À exécuter dans l'éditeur SQL Supabase.
-- Script idempotent : peut être relancé sans effet si déjà appliqué.

-- 1. Ajout de la valeur AVENANT_LOT dans l'enum AmendmentType
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'AVENANT_LOT'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AmendmentType')
  ) THEN
    ALTER TYPE "AmendmentType" ADD VALUE 'AVENANT_LOT';
  END IF;
END $$;

-- 2. Ajout de la colonne documentId sur LeaseAmendment
ALTER TABLE "LeaseAmendment"
  ADD COLUMN IF NOT EXISTS "documentId" TEXT;

-- 3. Index sur documentId
CREATE INDEX IF NOT EXISTS "LeaseAmendment_documentId_idx"
  ON "LeaseAmendment" ("documentId");

-- 4. Clé étrangère vers Document
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeaseAmendment_documentId_fkey'
  ) THEN
    ALTER TABLE "LeaseAmendment"
      ADD CONSTRAINT "LeaseAmendment_documentId_fkey"
      FOREIGN KEY ("documentId")
      REFERENCES "Document" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;