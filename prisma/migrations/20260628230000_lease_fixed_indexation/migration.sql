-- Indexation contractuelle à taux annuel fixe sur les baux longue durée
-- (centrales photovoltaïques, baux emphytéotiques, etc.). Au lieu de
-- piocher dans les indices INSEE, on applique un pourcentage défini au
-- contrat à chaque révision.

-- Nouveau type d'indexation dans l'enum.
ALTER TYPE "IndexType" ADD VALUE IF NOT EXISTS 'POURCENTAGE_FIXE';

-- Stockage du taux annuel (en %, ex: 2.0 pour +2%/an).
ALTER TABLE "Lease" ADD COLUMN "fixedAnnualIndexationRate" DOUBLE PRECISION;
