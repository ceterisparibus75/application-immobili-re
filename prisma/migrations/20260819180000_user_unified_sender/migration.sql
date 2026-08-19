-- Expéditeur email unifié : un admin peut configurer une seule adresse
-- qui sert pour toutes ses sociétés (fallback si Society.senderStatus n'est
-- pas vérifié).
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "unifiedSenderEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "unifiedSenderName" TEXT,
  ADD COLUMN IF NOT EXISTS "unifiedResendDomainId" TEXT,
  ADD COLUMN IF NOT EXISTS "unifiedSenderStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "unifiedSenderVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unifiedSenderRecords" JSONB;
