-- Stripe Connect Standard : paiement en ligne locataire
ALTER TABLE "Society"
  ADD COLUMN "stripeConnectId" TEXT,
  ADD COLUMN "stripeConnectStatus" TEXT,
  ADD COLUMN "stripeConnectAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Society_stripeConnectId_key" ON "Society"("stripeConnectId");

-- Lien de paiement sur chaque facture
ALTER TABLE "Invoice"
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripePaymentUrl" TEXT,
  ADD COLUMN "stripePaymentPaidAt" TIMESTAMP(3);
