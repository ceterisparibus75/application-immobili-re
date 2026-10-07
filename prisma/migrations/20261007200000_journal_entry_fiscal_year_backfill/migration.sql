-- Backfill JournalEntry.fiscalYearId pour les ecritures orphelines + index.
--
-- Contexte : la colonne JournalEntry.fiscalYearId est actuellement nullable.
-- L'application ne doit plus creer d'ecritures sans fiscalYearId (voir le
-- helper requireOpenFiscalYearIdForDate dans src/lib/accounting-period.ts),
-- mais la BDD historique contient des ecritures orphelines (ancien bug de
-- creation silencieuse sans exercice attache).
--
-- Cette migration realise 3 operations idempotentes :
--
--   (a) Associe chaque ecriture orpheline au FiscalYear de la meme societe
--       qui couvre entryDate (startDate <= entryDate <= endDate). Idempotent :
--       le UPDATE filtre sur fiscalYearId IS NULL, donc une re-execution
--       ne touche rien.
--
--   (b) Logue (RAISE NOTICE) les ecritures qui restent orphelines apres (a),
--       c'est-a-dire celles dont la entryDate n'est couverte par aucun
--       FiscalYear de la societe. Pas de DELETE, pas d'INSERT silencieux :
--       l'operateur devra creer l'exercice manquant ou corriger la date,
--       puis relancer la migration.
--
--   (c) Cree l'index (societyId, fiscalYearId) sur JournalEntry pour
--       accelerer grand livre, balance et export FEC. IF NOT EXISTS.
--
-- La contrainte NOT NULL sur fiscalYearId N'EST PAS posee ici volontairement.
-- Elle sera ajoutee dans une migration suivante, apres verification en prod
-- qu'aucune orpheline ne subsiste (voir la liste RAISE NOTICE dans les logs
-- de deploiement).

-- ============================================================================
-- (a) Backfill des orphelines sur base de la plage [startDate, endDate].
-- ============================================================================

UPDATE "JournalEntry" je
SET "fiscalYearId" = fy.id
FROM "FiscalYear" fy
WHERE je."fiscalYearId" IS NULL
  AND je."societyId" = fy."societyId"
  AND je."entryDate" >= fy."startDate"
  AND je."entryDate" <= fy."endDate";

-- ============================================================================
-- (b) Log des ecritures qui restent orphelines, groupees par societe.
--     RAISE NOTICE au niveau du serveur -> visible dans les logs Vercel /
--     dans la console lors d'un npx prisma migrate deploy. Pas d'erreur :
--     la migration reste reussie, c'est a l'operateur de nettoyer les
--     orphelines avant de poser le NOT NULL dans une migration suivante.
-- ============================================================================

DO $$
DECLARE
  orphan_count BIGINT := 0;
  society_count BIGINT := 0;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO orphan_count
    FROM "JournalEntry"
    WHERE "fiscalYearId" IS NULL;

  SELECT COUNT(DISTINCT "societyId") INTO society_count
    FROM "JournalEntry"
    WHERE "fiscalYearId" IS NULL;

  IF orphan_count = 0 THEN
    RAISE NOTICE 'JournalEntry backfill: 0 orpheline residuelle. OK pour poser NOT NULL ensuite.';
  ELSE
    RAISE NOTICE 'JournalEntry backfill: % orpheline(s) residuelle(s) reparties sur % societe(s). Detail ci-dessous :', orphan_count, society_count;
    FOR rec IN
      SELECT
        je."societyId" AS society_id,
        je.id AS entry_id,
        je."entryDate" AS entry_date,
        je."journalType" AS journal_type,
        je.piece AS piece,
        je.label AS label
      FROM "JournalEntry" je
      WHERE je."fiscalYearId" IS NULL
      ORDER BY je."societyId", je."entryDate"
    LOOP
      RAISE NOTICE '  societyId=% entryId=% entryDate=% journal=% piece=% label=%',
        rec.society_id, rec.entry_id, rec.entry_date, rec.journal_type,
        COALESCE(rec.piece, '-'), rec.label;
    END LOOP;
    RAISE NOTICE 'Action requise : creer l''exercice fiscal couvrant ces dates (ou corriger la date), puis relancer migrate deploy.';
  END IF;
END
$$;

-- ============================================================================
-- (c) Index (societyId, fiscalYearId) pour acceleration des requetes compta.
-- ============================================================================

CREATE INDEX IF NOT EXISTS "JournalEntry_societyId_fiscalYearId_idx"
  ON "JournalEntry" ("societyId", "fiscalYearId");
