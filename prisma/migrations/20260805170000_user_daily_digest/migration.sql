-- Digest quotidien : email récap matinal (opt-out possible)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "dailyDigestLastSentAt" TIMESTAMP(3);
