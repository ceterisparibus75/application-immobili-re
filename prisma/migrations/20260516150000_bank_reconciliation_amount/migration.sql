-- Ajoute un montant alloué par lien de rapprochement pour supporter :
--   - 1 virement → N factures (ventilation)
--   - virement > facture (avec excédent à traiter ailleurs)
--   - virement < facture (paiement partiel)
-- Le montant est ce que cette ligne de réconciliation "couvre" sur la transaction.

-- Step 1 : ajouter la colonne avec un défaut temporaire pour les lignes existantes.
ALTER TABLE "BankReconciliation"
  ADD COLUMN "amount" DOUBLE PRECISION;

-- Step 2 : backfill — pour chaque ligne, amount = payment.amount.
UPDATE "BankReconciliation" br
SET "amount" = p."amount"
FROM "Payment" p
WHERE br."paymentId" = p."id"
  AND br."amount" IS NULL;

-- Step 3 : appliquer la contrainte NOT NULL (sécurise les futures lignes).
ALTER TABLE "BankReconciliation"
  ALTER COLUMN "amount" SET NOT NULL;

-- Step 4 : retirer la contrainte d'unicité (transactionId, paymentId).
-- Une transaction peut maintenant être liée plusieurs fois au même paiement
-- via différentes allocations, et un même paiement peut être ventilé sur
-- plusieurs transactions. La validation logique passe par `amount`.
-- En pratique on garde l'unicité pour éviter les doublons triviaux, mais
-- on autorise plusieurs paiements distincts pour une même transaction.
-- (Pas de DROP CONSTRAINT ici : le couple reste unique, c'est cohérent.)
