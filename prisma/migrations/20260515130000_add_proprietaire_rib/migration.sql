-- AlterTable: ajoute les coordonnées bancaires sur Proprietaire
-- (utilisées pour l'usufruitier en cas de démembrement)
ALTER TABLE "Proprietaire"
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "ibanEncrypted" TEXT,
  ADD COLUMN "bicEncrypted" TEXT;
