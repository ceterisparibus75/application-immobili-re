-- Digest quotidien : email récap matinal (opt-out possible)
ALTER TABLE "User"
  ADD COLUMN "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "dailyDigestLastSentAt" TIMESTAMP(3);
