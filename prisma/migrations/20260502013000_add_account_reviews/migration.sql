-- CreateEnum
CREATE TYPE "AccountReviewStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEWED', 'ISSUE');

-- CreateTable
CREATE TABLE "AccountReview" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "AccountReviewStatus" NOT NULL DEFAULT 'TODO',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "AccountReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountReview_societyId_fiscalYearId_accountId_key" ON "AccountReview"("societyId", "fiscalYearId", "accountId");

-- CreateIndex
CREATE INDEX "AccountReview_societyId_fiscalYearId_idx" ON "AccountReview"("societyId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "AccountReview_accountId_idx" ON "AccountReview"("accountId");

-- CreateIndex
CREATE INDEX "AccountReview_status_idx" ON "AccountReview"("status");

-- AddForeignKey
ALTER TABLE "AccountReview" ADD CONSTRAINT "AccountReview_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountReview" ADD CONSTRAINT "AccountReview_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountReview" ADD CONSTRAINT "AccountReview_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
