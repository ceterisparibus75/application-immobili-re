-- Link accounting entries to GED supporting documents.
ALTER TABLE "JournalEntry" ADD COLUMN "documentId" TEXT;

CREATE INDEX "JournalEntry_documentId_idx" ON "JournalEntry"("documentId");

ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
