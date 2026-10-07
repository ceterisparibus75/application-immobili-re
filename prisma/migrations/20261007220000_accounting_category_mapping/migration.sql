-- Mapping personnalisable catégorie → compte PCG, par société (idempotent).
--
-- Permet à chaque société de surcharger les codes PCG utilisés par les
-- helpers de catégorisation (cashflow, charges) sans modifier le code.
--
-- Deux formes de clé possibles (exclusives) :
--   * cashflowCategoryId : ID d'une catégorie cashflow ("energie", "assurance"...)
--   * keyword            : mot-clé libre matché contre le nom d'une catégorie
--                          de charge ("ELECTRICITE", "ASCENSEUR"...)
--
-- Les deux contraintes d'unicité partielles sont posées sur (societyId, cle)
-- ce qui autorise plusieurs lignes "clé vide" du côté opposé.

CREATE TABLE IF NOT EXISTS "AccountingCategoryMapping" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "cashflowCategoryId" TEXT,
    "keyword" TEXT,
    "accountCode" TEXT NOT NULL,
    "accountLabel" TEXT,
    "notes" TEXT,

    CONSTRAINT "AccountingCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- Index + contraintes idempotents.
CREATE INDEX IF NOT EXISTS "AccountingCategoryMapping_societyId_idx"
    ON "AccountingCategoryMapping"("societyId");

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingCategoryMapping_societyId_cashflowCategoryId_key"
    ON "AccountingCategoryMapping"("societyId", "cashflowCategoryId");

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingCategoryMapping_societyId_keyword_key"
    ON "AccountingCategoryMapping"("societyId", "keyword");

-- Foreign key — ajoutée seulement si absente (idempotence).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AccountingCategoryMapping_societyId_fkey'
    ) THEN
        ALTER TABLE "AccountingCategoryMapping"
            ADD CONSTRAINT "AccountingCategoryMapping_societyId_fkey"
            FOREIGN KEY ("societyId") REFERENCES "Society"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
