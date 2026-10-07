-- Finalise le durcissement de JournalEntry.fiscalYearId : pose la contrainte
-- NOT NULL apres s'etre assure qu'aucune ecriture orpheline ne subsiste.
--
-- Contexte : la migration 20261007200000_journal_entry_fiscal_year_backfill
-- a (a) backfille les orphelines a partir de la plage [startDate, endDate]
-- des FiscalYear existants et (b) RAISE NOTICE les orphelines residuelles
-- (sans erreur, pour laisser le temps a l'operateur de creer les exercices
-- manquants). La presente migration finalise le passage en NOT NULL.
--
-- Operations idempotentes :
--
--   (1) Re-tenter le backfill au cas ou des ecritures orphelines auraient ete
--       creees entre la precedente migration et celle-ci (code applicatif
--       bugge, scripts manuels, imports…). Identique a l'etape (a) de la
--       migration de backfill — strictement idempotent (filtre IS NULL).
--
--   (2) Guard anti-corruption : si des orphelines subsistent apres (1), ABORT
--       la migration AVANT de poser NOT NULL. L'operateur voit un message
--       clair, la BDD reste coherente, le deploy rollback proprement.
--       Pas de risque de corruption : le ALTER COLUMN SET NOT NULL
--       echouerait lui-meme sur Postgres si des NULL subsistaient, mais on
--       prefere un message d'erreur explicite plutot qu'un cryptique
--       "column contains null values".
--
--   (3) Pose le NOT NULL de maniere idempotente : si la colonne est deja
--       NOT NULL (migration deja passee), ne rien faire (no-op). Autorise
--       les reruns et les restaurations partielles.

-- ============================================================================
-- (1) Re-backfill des orphelines eventuelles creees depuis la precedente
--     migration. Strictement idempotent : WHERE "fiscalYearId" IS NULL.
-- ============================================================================

UPDATE "JournalEntry" je
SET "fiscalYearId" = fy.id
FROM "FiscalYear" fy
WHERE je."fiscalYearId" IS NULL
  AND je."societyId" = fy."societyId"
  AND je."entryDate" >= fy."startDate"
  AND je."entryDate" <= fy."endDate";

-- ============================================================================
-- (2) Guard anti-corruption : abort si orphelines residuelles.
-- ============================================================================

DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "JournalEntry" WHERE "fiscalYearId" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Impossible de poser NOT NULL : % JournalEntry orphelines (fiscalYearId NULL). Lancez d''abord la migration 20261007200000 et inspectez les RAISE NOTICE, creez les FiscalYear manquants, puis relancez.', orphan_count;
  END IF;
END $$;

-- ============================================================================
-- (3) Pose NOT NULL (idempotent via DO block : no-op si deja posee).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'JournalEntry'
      AND column_name = 'fiscalYearId'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "JournalEntry" ALTER COLUMN "fiscalYearId" SET NOT NULL;
  END IF;
END $$;
