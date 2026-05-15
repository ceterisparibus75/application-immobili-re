-- AlterTable: tier auxiliaire pour les lignes d'écriture (DGFiP CompAuxNum)
ALTER TABLE "JournalEntryLine"
  ADD COLUMN "auxiliaryProprietaireId" TEXT;

-- CreateIndex
CREATE INDEX "JournalEntryLine_auxiliaryProprietaireId_idx"
  ON "JournalEntryLine"("auxiliaryProprietaireId");

-- AddForeignKey
ALTER TABLE "JournalEntryLine"
  ADD CONSTRAINT "JournalEntryLine_auxiliaryProprietaireId_fkey"
  FOREIGN KEY ("auxiliaryProprietaireId") REFERENCES "Proprietaire"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
