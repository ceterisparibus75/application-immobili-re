-- Adresse expéditrice personnalisée par société (Resend Domains)
ALTER TABLE "Society"
  ADD COLUMN IF NOT EXISTS "senderEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "senderName" TEXT,
  ADD COLUMN IF NOT EXISTS "resendDomainId" TEXT,
  ADD COLUMN IF NOT EXISTS "senderStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "senderVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "senderRecords" JSONB;
