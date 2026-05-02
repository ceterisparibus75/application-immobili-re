-- Repair production databases where the previous BankTransaction -> JournalEntry
-- migration was marked applied without the physical column being present.
ALTER TABLE "BankTransaction" ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "BankTransaction_journalEntryId_key" ON "BankTransaction"("journalEntryId");
CREATE INDEX IF NOT EXISTS "BankTransaction_journalEntryId_idx" ON "BankTransaction"("journalEntryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BankTransaction_journalEntryId_fkey'
  ) THEN
    ALTER TABLE "BankTransaction"
      ADD CONSTRAINT "BankTransaction_journalEntryId_fkey"
      FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
