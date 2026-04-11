-- Migration : Support personne physique + regimes fiscaux
-- Date : 2026-04-11

-- ============================================================
-- 1. Ajouter PERSONNE_PHYSIQUE a l'enum LegalForm
-- ============================================================
ALTER TYPE "LegalForm" ADD VALUE IF NOT EXISTS 'PERSONNE_PHYSIQUE';

-- ============================================================
-- 2. Rendre le champ siret nullable
-- ============================================================
ALTER TABLE "Society" ALTER COLUMN "siret" DROP NOT NULL;

-- ============================================================
-- 3. Creer l'enum FiscalRegime
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "FiscalRegime" AS ENUM (
    'MICRO_FONCIER',
    'REEL_FONCIER',
    'LMNP_MICRO_BIC',
    'LMNP_REEL',
    'LMP',
    'MEUBLE_TOURISME'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. Ajouter le champ fiscalRegime sur Society
-- ============================================================
ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "fiscalRegime" "FiscalRegime";

-- ============================================================
-- 5. Ajouter le champ fiscalRegime sur Lot
-- ============================================================
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "fiscalRegime" "FiscalRegime";
