-- Adresse expéditrice personnalisée par société (Resend Domains)
ALTER TABLE "Society"
  ADD COLUMN "senderEmail" TEXT,
  ADD COLUMN "senderName" TEXT,
  ADD COLUMN "resendDomainId" TEXT,
  ADD COLUMN "senderStatus" TEXT,
  ADD COLUMN "senderVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "senderRecords" JSONB;
