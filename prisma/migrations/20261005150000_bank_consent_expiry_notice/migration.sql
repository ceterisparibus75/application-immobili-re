-- Rappels d'expiration PSD2 pour les connexions bancaires (idempotent).

ALTER TABLE "BankConnection" ADD COLUMN IF NOT EXISTS "lastExpiryNoticeAt" TIMESTAMP(3);
ALTER TABLE "BankConnection" ADD COLUMN IF NOT EXISTS "lastExpiryNoticeStage" TEXT;

-- Nouveau type de notification in-app (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType'
      AND e.enumlabel = 'BANK_CONSENT_EXPIRING'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'BANK_CONSENT_EXPIRING';
  END IF;
END
$$;
