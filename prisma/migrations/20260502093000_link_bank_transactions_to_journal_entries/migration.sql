-- Link generated BQUE journal entries to their source bank transactions.
ALTER TABLE "BankTransaction" ADD COLUMN "journalEntryId" TEXT;

CREATE UNIQUE INDEX "BankTransaction_journalEntryId_key" ON "BankTransaction"("journalEntryId");
CREATE INDEX "BankTransaction_journalEntryId_idx" ON "BankTransaction"("journalEntryId");

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
