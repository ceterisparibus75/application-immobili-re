-- Migration : Ajout du modèle TransactionAutoTag
-- Auto-tag : associe un libellé bancaire normalisé à une catégorie cash-flow.
-- Quand l'utilisateur catégorise une transaction, le pattern est mémorisé
-- pour catégoriser automatiquement les futures transactions identiques.

CREATE TABLE IF NOT EXISTS "TransactionAutoTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "exampleLabel" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TransactionAutoTag_pkey" PRIMARY KEY ("id")
);

-- Index pour recherche rapide par société
CREATE INDEX IF NOT EXISTS "TransactionAutoTag_societyId_idx" ON "TransactionAutoTag"("societyId");

-- Contrainte unique : un seul tag par libellé normalisé par société
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionAutoTag_societyId_normalizedLabel_key" ON "TransactionAutoTag"("societyId", "normalizedLabel");

-- Clé étrangère vers Society
ALTER TABLE "TransactionAutoTag" ADD CONSTRAINT "TransactionAutoTag_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
