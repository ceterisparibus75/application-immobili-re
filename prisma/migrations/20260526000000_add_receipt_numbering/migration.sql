-- Séquence de numérotation dédiée pour les quittances de loyer.
-- Les quittances sont des reçus de paiement, pas des titres de créance :
-- elles ne doivent pas consommer la séquence facture (sinon elle saute).
-- Le format émis est "QIT-YYYY-NNNN" (préfixe fixe, indépendant du préfixe société).

ALTER TABLE "Society"
  ADD COLUMN "nextReceiptNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "receiptNumberYear" INTEGER NOT NULL DEFAULT 0;
