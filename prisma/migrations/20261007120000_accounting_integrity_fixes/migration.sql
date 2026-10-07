-- Corrections d integrite comptable (idempotent).
--
-- 1. Society.nextLetteringSequence : compteur atomique pour getNextLetteringCode
--    (fix race condition, meme pattern que nextInvoiceNumber).
--
-- 2. JournalEntry.updatedAt + validatedAt : tracabilite de la validation
--    (passage BROUILLON -> VALIDEE) et de toute mutation.

-- 1. Compteur de lettrage par societe.
ALTER TABLE "Society" ADD COLUMN IF NOT EXISTS "nextLetteringSequence" INTEGER NOT NULL DEFAULT 1;

-- Backfill : initialiser le compteur a (max_sequence_existante + 1) pour chaque
-- societe deja utilisee, afin que la prochaine allocation ne reutilise pas un
-- code deja pose. Le code "A" tout seul (longueur 1) est historique et ignore.
--
-- Convention : code <-> sequence (base 26 bijective sur >= 2 lettres)
--   "AA"  -> 1
--   "AZ"  -> 26
--   "BA"  -> 27
--   "ZZ"  -> 676
--   "AAA" -> 677
--   ...
--
-- La formule : pour un code de longueur L (>= 2), somme des 26^k pour
-- k=2..L-1 (offsets des longueurs precedentes), plus la conversion
-- base 26 (A=0,...,Z=25) du code sur L chiffres, plus 1 pour passer en 1-based.
DO $$
DECLARE
  rec RECORD;
  code TEXT;
  code_len INT;
  seq_val BIGINT;
  i INT;
  max_seq BIGINT;
  society_rec RECORD;
BEGIN
  FOR society_rec IN SELECT DISTINCT je."societyId" AS sid
    FROM "JournalEntry" je
  LOOP
    max_seq := 0;
    FOR rec IN
      SELECT DISTINCT COALESCE(l."letteringCode", l."lettrage") AS code
      FROM "JournalEntryLine" l
      JOIN "JournalEntry" je ON je.id = l."journalEntryId"
      WHERE je."societyId" = society_rec.sid
        AND (l."letteringCode" IS NOT NULL OR l."lettrage" IS NOT NULL)
    LOOP
      code := rec.code;
      code_len := length(code);
      -- Ignorer les codes vides, de longueur 1, ou contenant autre chose
      -- que A-Z majuscules (donnees historiques potentiellement sales).
      IF code IS NULL OR code_len < 2 OR code !~ '^[A-Z]+$' THEN
        CONTINUE;
      END IF;

      seq_val := 0;
      -- Offsets des longueurs plus courtes (2..L-1) : sum of 26^k.
      FOR i IN 2..(code_len - 1) LOOP
        seq_val := seq_val + power(26::bigint, i);
      END LOOP;
      -- Conversion base 26 : chaque lettre contribue (ascii(c) - 65) * 26^(L-1-pos).
      FOR i IN 1..code_len LOOP
        seq_val := seq_val * 26 + (ascii(substring(code FROM i FOR 1)) - 65);
      END LOOP;
      seq_val := seq_val + 1;

      IF seq_val > max_seq THEN
        max_seq := seq_val;
      END IF;
    END LOOP;

    -- Le compteur store la prochaine valeur APRES increment (voir
    -- getNextLetteringCode : seq consommee = stored - 1 apres UPDATE +1
    -- RETURNING). Pour que la prochaine allocation renvoie max_seq + 1,
    -- on stocke max_seq + 1 (default 1 reste correct quand max_seq = 0).
    UPDATE "Society"
    SET "nextLetteringSequence" = GREATEST("nextLetteringSequence", max_seq + 1)
    WHERE id = society_rec.sid;
  END LOOP;
END
$$;

-- 2. Tracabilite des ecritures comptables.
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);

-- Backfill : updatedAt pour les lignes existantes = createdAt (meilleur
-- defaut sans historique). validatedAt pour les ecritures deja validees
-- = createdAt (approximation acceptable, l horodatage precis n etait pas
-- stocke avant cette migration).
UPDATE "JournalEntry" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
UPDATE "JournalEntry" SET "validatedAt" = "createdAt"
  WHERE "isValidated" = true AND "validatedAt" IS NULL;

-- Rendre updatedAt NOT NULL maintenant que toutes les lignes sont renseignees.
ALTER TABLE "JournalEntry" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "JournalEntry" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
