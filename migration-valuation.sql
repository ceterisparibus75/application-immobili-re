-- Enums
CREATE TYPE "ValuationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "AiProvider" AS ENUM ('CLAUDE', 'GEMINI');
CREATE TYPE "RentValuationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- PropertyValuation
CREATE TABLE "PropertyValuation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildingId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ValuationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "estimatedValueLow" DOUBLE PRECISION,
    "estimatedValueMid" DOUBLE PRECISION,
    "estimatedValueHigh" DOUBLE PRECISION,
    "estimatedRentalValue" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "capitalizationRate" DOUBLE PRECISION,
    CONSTRAINT "PropertyValuation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PropertyValuation_buildingId_idx" ON "PropertyValuation"("buildingId");
CREATE INDEX "PropertyValuation_societyId_idx" ON "PropertyValuation"("societyId");
CREATE INDEX "PropertyValuation_societyId_buildingId_idx" ON "PropertyValuation"("societyId", "buildingId");
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE;
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE;

-- AiValuationAnalysis
CREATE TABLE "AiValuationAnalysis" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "structuredResult" JSONB NOT NULL,
    "estimatedValue" DOUBLE PRECISION,
    "rentalValue" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "capRate" DOUBLE PRECISION,
    "methodology" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "opportunities" JSONB,
    "threats" JSONB,
    "confidence" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "tokenCount" INTEGER,
    "cost" DOUBLE PRECISION,
    CONSTRAINT "AiValuationAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiValuationAnalysis_valuationId_idx" ON "AiValuationAnalysis"("valuationId");
ALTER TABLE "AiValuationAnalysis" ADD CONSTRAINT "AiValuationAnalysis_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE;

-- ExpertReport
CREATE TABLE "ExpertReport" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "expertName" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportReference" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "extractedData" JSONB NOT NULL,
    "estimatedValue" DOUBLE PRECISION,
    "rentalValue" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "capRate" DOUBLE PRECISION,
    "usableArea" DOUBLE PRECISION,
    "methodology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpertReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpertReport_valuationId_idx" ON "ExpertReport"("valuationId");
ALTER TABLE "ExpertReport" ADD CONSTRAINT "ExpertReport_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE;

-- ComparableSale
CREATE TABLE "ComparableSale" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "builtArea" DOUBLE PRECISION,
    "landArea" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "propertyType" TEXT NOT NULL,
    "buildingAge" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "relevanceComment" TEXT,
    CONSTRAINT "ComparableSale_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComparableSale_valuationId_idx" ON "ComparableSale"("valuationId");
ALTER TABLE "ComparableSale" ADD CONSTRAINT "ComparableSale_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE;

-- ConsolidatedReport
CREATE TABLE "ConsolidatedReport" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "reportContent" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    CONSTRAINT "ConsolidatedReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsolidatedReport_valuationId_key" ON "ConsolidatedReport"("valuationId");
ALTER TABLE "ConsolidatedReport" ADD CONSTRAINT "ConsolidatedReport_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE;

-- RentValuation
CREATE TABLE "RentValuation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leaseId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RentValuationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "currentRent" DOUBLE PRECISION,
    "estimatedMarketRent" DOUBLE PRECISION,
    "estimatedRentLow" DOUBLE PRECISION,
    "estimatedRentHigh" DOUBLE PRECISION,
    "rentPerSqm" DOUBLE PRECISION,
    "deviationPercent" DOUBLE PRECISION,
    CONSTRAINT "RentValuation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RentValuation_leaseId_idx" ON "RentValuation"("leaseId");
CREATE INDEX "RentValuation_societyId_idx" ON "RentValuation"("societyId");
CREATE INDEX "RentValuation_societyId_leaseId_idx" ON "RentValuation"("societyId", "leaseId");
ALTER TABLE "RentValuation" ADD CONSTRAINT "RentValuation_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE;
ALTER TABLE "RentValuation" ADD CONSTRAINT "RentValuation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE;

-- RentAiAnalysis
CREATE TABLE "RentAiAnalysis" (
    "id" TEXT NOT NULL,
    "rentValuationId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "structuredResult" JSONB NOT NULL,
    "estimatedRent" DOUBLE PRECISION,
    "rentPerSqm" DOUBLE PRECISION,
    "methodology" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "opportunities" JSONB,
    "threats" JSONB,
    "confidence" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "tokenCount" INTEGER,
    "cost" DOUBLE PRECISION,
    CONSTRAINT "RentAiAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RentAiAnalysis_rentValuationId_idx" ON "RentAiAnalysis"("rentValuationId");
ALTER TABLE "RentAiAnalysis" ADD CONSTRAINT "RentAiAnalysis_rentValuationId_fkey" FOREIGN KEY ("rentValuationId") REFERENCES "RentValuation"("id") ON DELETE CASCADE;

-- ComparableRent
CREATE TABLE "ComparableRent" (
    "id" TEXT NOT NULL,
    "rentValuationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "rentDate" TIMESTAMP(3) NOT NULL,
    "annualRent" DOUBLE PRECISION NOT NULL,
    "area" DOUBLE PRECISION,
    "rentPerSqm" DOUBLE PRECISION,
    "propertyType" TEXT NOT NULL,
    "leaseType" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "relevanceComment" TEXT,
    CONSTRAINT "ComparableRent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComparableRent_rentValuationId_idx" ON "ComparableRent"("rentValuationId");
ALTER TABLE "ComparableRent" ADD CONSTRAINT "ComparableRent_rentValuationId_fkey" FOREIGN KEY ("rentValuationId") REFERENCES "RentValuation"("id") ON DELETE CASCADE;

-- RentConsolidatedReport
CREATE TABLE "RentConsolidatedReport" (
    "id" TEXT NOT NULL,
    "rentValuationId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "reportContent" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    CONSTRAINT "RentConsolidatedReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RentConsolidatedReport_rentValuationId_key" ON "RentConsolidatedReport"("rentValuationId");
ALTER TABLE "RentConsolidatedReport" ADD CONSTRAINT "RentConsolidatedReport_rentValuationId_fkey" FOREIGN KEY ("rentValuationId") REFERENCES "RentValuation"("id") ON DELETE CASCADE;
