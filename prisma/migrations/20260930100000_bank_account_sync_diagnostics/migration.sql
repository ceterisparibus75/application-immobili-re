-- Ajout de diagnostics de synchronisation bancaire (idempotent).
-- Distinguer "dernier import reussi" (lastSyncAt) de "derniere tentative"
-- (lastSyncAttemptAt), et conserver le message d'erreur du dernier sync KO.

ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "lastSyncAttemptAt" TIMESTAMP(3);
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT;
