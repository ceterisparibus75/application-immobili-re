-- Stripe Connect Standard : paiement en ligne locataire
ALTER TABLE "Society"
  ADD COLUMN IF NOT EXISTS "stripeConnectId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeConnectStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeConnectAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Society_stripeConnectId_key" ON "Society"("stripeConnectId");

-- Lien de paiement sur chaque facture
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePaymentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePaymentPaidAt" TIMESTAMP(3);
