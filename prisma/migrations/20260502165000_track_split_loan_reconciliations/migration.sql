-- Track separately reconciled loan installment components when banks debit
-- principal, interests, and insurance as distinct transactions.
ALTER TABLE "LoanAmortizationLine"
  ADD COLUMN IF NOT EXISTS "principalPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interestPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "insurancePaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "principalBankTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "interestBankTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceBankTransactionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LoanAmortizationLine_principalBankTransactionId_key"
  ON "LoanAmortizationLine"("principalBankTransactionId");

CREATE UNIQUE INDEX IF NOT EXISTS "LoanAmortizationLine_interestBankTransactionId_key"
  ON "LoanAmortizationLine"("interestBankTransactionId");

CREATE UNIQUE INDEX IF NOT EXISTS "LoanAmortizationLine_insuranceBankTransactionId_key"
  ON "LoanAmortizationLine"("insuranceBankTransactionId");
