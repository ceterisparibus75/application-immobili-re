-- AlterEnum: add AVENANT_LOT value (cannot run inside a transaction)
ALTER TYPE "AmendmentType" ADD VALUE IF NOT EXISTS 'AVENANT_LOT';

-- AlterTable: add documentId column to LeaseAmendment
ALTER TABLE "LeaseAmendment" ADD COLUMN "documentId" TEXT;

-- CreateIndex
CREATE INDEX "LeaseAmendment_documentId_idx" ON "LeaseAmendment"("documentId");

-- AddForeignKey
ALTER TABLE "LeaseAmendment" ADD CONSTRAINT "LeaseAmendment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;