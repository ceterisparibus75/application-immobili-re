-- Persistance du numero FEC (EcritureNum) sur JournalEntry.
--
-- Contexte : l'export FEC (DGFiP, article A.47 A-1 LPF) calculait auparavant
-- l'EcritureNum a la volee via un compteur reinitialise a chaque export. Deux
-- exports successifs du meme exercice pouvaient donc produire des numeros
-- differents si l'ordre des entries changeait, ce qui viole l'inalterabilite
-- exigee par l'article 54 du CGI pour un exercice clos.
--
-- Correctif : on persiste l'EcritureNum attribue au moment de la cloture de
-- l'exercice (ou lors d'une assignation manuelle). Une fois pose, le numero
-- reste identique a chaque re-export.
--
-- Format retenu : chaine numerique zero-paddee sur 8 chiffres, sequentielle
-- par exercice (fiscalYearId) sans trou, ordonnee par (entryDate ASC,
-- createdAt ASC). Un seul compteur unique par exercice (recommandation
-- usuelle DGFiP), pas un compteur par journal.
--
-- Migration idempotente : ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "fecEcritureNum" TEXT;

-- Index pour acceleration de l'ordre d'export et des lookups par (fiscalYearId, num).
-- Non-unique volontairement : les anciennes JournalEntry sans fiscalYearId peuvent
-- toutes avoir fecEcritureNum NULL (NULL n'est pas unique en PostgreSQL par defaut
-- mais on evite tout cas limite).
CREATE INDEX IF NOT EXISTS "JournalEntry_fiscalYearId_fecEcritureNum_idx"
  ON "JournalEntry" ("fiscalYearId", "fecEcritureNum");
