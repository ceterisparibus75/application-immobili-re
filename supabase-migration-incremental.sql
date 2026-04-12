-- ==========================================================================
-- INCREMENTAL MIGRATION — New tables & enums only (Phases 13–16)
-- Safe to run on an existing database: uses IF NOT EXISTS / DO $$ blocks
-- Generated: 2026-04-12
-- ==========================================================================

-- ==========================================================================
-- 1. NEW ENUMS
-- ==========================================================================

-- Phase 13: Syndic de copropriete
DO $$ BEGIN
    CREATE TYPE "CoproBudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CoproAssemblyType" AS ENUM ('ORDINAIRE', 'EXTRAORDINAIRE', 'MIXTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CoproAssemblyStatus" AS ENUM ('PLANNED', 'CONVOCATION_SENT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CoproMajority" AS ENUM ('SIMPLE', 'ABSOLUE', 'DOUBLE', 'UNANIMITE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CoproResolutionStatus" AS ENUM ('PENDING', 'ADOPTED', 'REJECTED', 'DEFERRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CoproVoteChoice" AS ENUM ('POUR', 'CONTRE', 'ABSTENTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 14: Location saisonniere
DO $$ BEGIN
    CREATE TYPE "SeasonalPropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'STUDIO', 'ROOM', 'GITE', 'CHALET');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SeasonalBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 15: CRM / Pipeline candidatures
DO $$ BEGIN
    CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'VISIT_DONE', 'DOSSIER_RECEIVED', 'DOSSIER_VALIDATED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CandidateActivityType" AS ENUM ('NOTE', 'EMAIL_SENT', 'CALL', 'VISIT', 'DOCUMENT_RECEIVED', 'STATUS_CHANGE', 'SCORE_UPDATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 16: Workflows visuels
DO $$ BEGIN
    CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================================
-- 2. NEW TABLES
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Phase 13: Syndic de copropriete
-- --------------------------------------------------------------------------

-- Copropriete
CREATE TABLE IF NOT EXISTS "Copropriete" (
    "id"              TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "societyId"       TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "address"         TEXT NOT NULL,
    "city"            TEXT NOT NULL,
    "postalCode"      TEXT NOT NULL,
    "totalTantiemes"  INTEGER NOT NULL,
    "fiscalYearStart" INTEGER NOT NULL DEFAULT 1,
    "siret"           TEXT,
    "notes"           TEXT,

    CONSTRAINT "Copropriete_pkey" PRIMARY KEY ("id")
);

-- CoproLot
CREATE TABLE IF NOT EXISTS "CoproLot" (
    "id"            TEXT NOT NULL,
    "coproprieteId" TEXT NOT NULL,
    "lotNumber"     TEXT NOT NULL,
    "ownerName"     TEXT NOT NULL,
    "ownerEmail"    TEXT,
    "tantiemes"     INTEGER NOT NULL,
    "description"   TEXT,
    "floor"         TEXT,
    "area"          DOUBLE PRECISION,

    CONSTRAINT "CoproLot_pkey" PRIMARY KEY ("id")
);

-- CoproBudget
CREATE TABLE IF NOT EXISTS "CoproBudget" (
    "id"                     TEXT NOT NULL,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    "coproprieteId"          TEXT NOT NULL,
    "year"                   INTEGER NOT NULL,
    "status"                 "CoproBudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount"            DOUBLE PRECISION NOT NULL,
    "lines"                  JSONB NOT NULL,
    "notes"                  TEXT,
    "approvedAt"             TIMESTAMP(3),
    "approvedByAssemblyId"   TEXT,

    CONSTRAINT "CoproBudget_pkey" PRIMARY KEY ("id")
);

-- CoproAssembly
CREATE TABLE IF NOT EXISTS "CoproAssembly" (
    "id"                 TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    "coproprieteId"      TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "date"               TIMESTAMP(3) NOT NULL,
    "type"               "CoproAssemblyType" NOT NULL DEFAULT 'ORDINAIRE',
    "status"             "CoproAssemblyStatus" NOT NULL DEFAULT 'PLANNED',
    "location"           TEXT,
    "isOnline"           BOOLEAN NOT NULL DEFAULT false,
    "quorumRequired"     DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "convocationSentAt"  TIMESTAMP(3),
    "convocationFileUrl" TEXT,
    "pvFileUrl"          TEXT,
    "pvApprovedAt"       TIMESTAMP(3),
    "notes"              TEXT,

    CONSTRAINT "CoproAssembly_pkey" PRIMARY KEY ("id")
);

-- CoproResolution
CREATE TABLE IF NOT EXISTS "CoproResolution" (
    "id"           TEXT NOT NULL,
    "assemblyId"   TEXT NOT NULL,
    "number"       INTEGER NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "majority"     "CoproMajority" NOT NULL DEFAULT 'SIMPLE',
    "status"       "CoproResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "votesFor"     INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "abstentions"  INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoproResolution_pkey" PRIMARY KEY ("id")
);

-- CoproVote
CREATE TABLE IF NOT EXISTS "CoproVote" (
    "id"           TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "lotId"        TEXT NOT NULL,
    "vote"         "CoproVoteChoice" NOT NULL,
    "proxy"        BOOLEAN NOT NULL DEFAULT false,
    "proxyName"    TEXT,

    CONSTRAINT "CoproVote_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------------------
-- Phase 14: Location saisonniere
-- --------------------------------------------------------------------------

-- SeasonalProperty
CREATE TABLE IF NOT EXISTS "SeasonalProperty" (
    "id"             TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "societyId"      TEXT NOT NULL,
    "lotId"          TEXT,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "address"        TEXT NOT NULL,
    "city"           TEXT NOT NULL,
    "postalCode"     TEXT NOT NULL,
    "country"        TEXT NOT NULL DEFAULT 'France',
    "propertyType"   "SeasonalPropertyType" NOT NULL DEFAULT 'APARTMENT',
    "capacity"       INTEGER NOT NULL,
    "bedrooms"       INTEGER NOT NULL,
    "bathrooms"      INTEGER NOT NULL,
    "area"           DOUBLE PRECISION,
    "amenities"      JSONB,
    "photos"         JSONB,
    "checkInTime"    TEXT NOT NULL DEFAULT '15:00',
    "checkOutTime"   TEXT NOT NULL DEFAULT '11:00',
    "minStay"        INTEGER NOT NULL DEFAULT 1,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "otaConnections" JSONB,
    "icalUrl"        TEXT,

    CONSTRAINT "SeasonalProperty_pkey" PRIMARY KEY ("id")
);

-- SeasonalBooking
CREATE TABLE IF NOT EXISTS "SeasonalBooking" (
    "id"          TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "propertyId"  TEXT NOT NULL,
    "guestName"   TEXT NOT NULL,
    "guestEmail"  TEXT,
    "guestPhone"  TEXT,
    "guestCount"  INTEGER NOT NULL DEFAULT 1,
    "checkIn"     TIMESTAMP(3) NOT NULL,
    "checkOut"    TIMESTAMP(3) NOT NULL,
    "nights"      INTEGER NOT NULL,
    "totalPrice"  DOUBLE PRECISION NOT NULL,
    "cleaningFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue"  DOUBLE PRECISION NOT NULL,
    "status"      "SeasonalBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source"      TEXT,
    "externalId"  TEXT,
    "notes"       TEXT,

    CONSTRAINT "SeasonalBooking_pkey" PRIMARY KEY ("id")
);

-- SeasonalPricing
CREATE TABLE IF NOT EXISTS "SeasonalPricing" (
    "id"              TEXT NOT NULL,
    "propertyId"      TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3) NOT NULL,
    "pricePerNight"   DOUBLE PRECISION NOT NULL,
    "weeklyDiscount"  DOUBLE PRECISION,
    "monthlyDiscount" DOUBLE PRECISION,

    CONSTRAINT "SeasonalPricing_pkey" PRIMARY KEY ("id")
);

-- SeasonalBlockedDate
CREATE TABLE IF NOT EXISTS "SeasonalBlockedDate" (
    "id"         TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate"  TIMESTAMP(3) NOT NULL,
    "endDate"    TIMESTAMP(3) NOT NULL,
    "reason"     TEXT,

    CONSTRAINT "SeasonalBlockedDate_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------------------
-- Phase 15: CRM / Pipeline candidatures
-- --------------------------------------------------------------------------

-- CandidatePipeline
CREATE TABLE IF NOT EXISTS "CandidatePipeline" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "societyId" TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "stages"    JSONB NOT NULL,

    CONSTRAINT "CandidatePipeline_pkey" PRIMARY KEY ("id")
);

-- Candidate
CREATE TABLE IF NOT EXISTS "Candidate" (
    "id"            TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    "societyId"     TEXT NOT NULL,
    "pipelineId"    TEXT,
    "lotId"         TEXT,
    "firstName"     TEXT NOT NULL,
    "lastName"      TEXT NOT NULL,
    "email"         TEXT,
    "phone"         TEXT,
    "company"       TEXT,
    "stageId"       TEXT,
    "score"         INTEGER,
    "source"        TEXT,
    "status"        "CandidateStatus" NOT NULL DEFAULT 'NEW',
    "monthlyIncome" DOUBLE PRECISION,
    "guarantorName" TEXT,
    "desiredMoveIn" TIMESTAMP(3),
    "notes"         TEXT,
    "documents"     JSONB,
    "tags"          JSONB,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CandidateActivity
CREATE TABLE IF NOT EXISTS "CandidateActivity" (
    "id"          TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidateId" TEXT NOT NULL,
    "type"        "CandidateActivityType" NOT NULL,
    "content"     TEXT,
    "userId"      TEXT,

    CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------------------
-- Phase 16: Workflows visuels
-- --------------------------------------------------------------------------

-- Workflow
CREATE TABLE IF NOT EXISTS "Workflow" (
    "id"          TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "societyId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT false,
    "trigger"     JSONB NOT NULL,
    "steps"       JSONB NOT NULL,
    "lastRunAt"   TIMESTAMP(3),
    "runCount"    INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- WorkflowRun
CREATE TABLE IF NOT EXISTS "WorkflowRun" (
    "id"          TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId"  TEXT NOT NULL,
    "status"      "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT,
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error"       TEXT,
    "stepResults" JSONB,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- ==========================================================================
-- 3. UNIQUE CONSTRAINTS (idempotent via DO $$ blocks)
-- ==========================================================================

-- CoproBudget: unique (coproprieteId, year)
DO $$ BEGIN
    ALTER TABLE "CoproBudget"
        ADD CONSTRAINT "CoproBudget_coproprieteId_year_key" UNIQUE ("coproprieteId", "year");
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

-- CoproVote: unique (resolutionId, lotId)
DO $$ BEGIN
    ALTER TABLE "CoproVote"
        ADD CONSTRAINT "CoproVote_resolutionId_lotId_key" UNIQUE ("resolutionId", "lotId");
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================================
-- 4. FOREIGN KEY CONSTRAINTS (idempotent via DO $$ blocks)
-- ==========================================================================

-- Phase 13: Copropriete
DO $$ BEGIN
    ALTER TABLE "Copropriete"
        ADD CONSTRAINT "Copropriete_societyId_fkey"
        FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CoproLot"
        ADD CONSTRAINT "CoproLot_coproprieteId_fkey"
        FOREIGN KEY ("coproprieteId") REFERENCES "Copropriete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CoproBudget"
        ADD CONSTRAINT "CoproBudget_coproprieteId_fkey"
        FOREIGN KEY ("coproprieteId") REFERENCES "Copropriete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CoproAssembly"
        ADD CONSTRAINT "CoproAssembly_coproprieteId_fkey"
        FOREIGN KEY ("coproprieteId") REFERENCES "Copropriete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CoproResolution"
        ADD CONSTRAINT "CoproResolution_assemblyId_fkey"
        FOREIGN KEY ("assemblyId") REFERENCES "CoproAssembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CoproVote"
        ADD CONSTRAINT "CoproVote_resolutionId_fkey"
        FOREIGN KEY ("resolutionId") REFERENCES "CoproResolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CoproVote"
        ADD CONSTRAINT "CoproVote_lotId_fkey"
        FOREIGN KEY ("lotId") REFERENCES "CoproLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 14: Location saisonniere
DO $$ BEGIN
    ALTER TABLE "SeasonalProperty"
        ADD CONSTRAINT "SeasonalProperty_societyId_fkey"
        FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SeasonalBooking"
        ADD CONSTRAINT "SeasonalBooking_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "SeasonalProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SeasonalPricing"
        ADD CONSTRAINT "SeasonalPricing_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "SeasonalProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SeasonalBlockedDate"
        ADD CONSTRAINT "SeasonalBlockedDate_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "SeasonalProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 15: CRM / Pipeline candidatures
DO $$ BEGIN
    ALTER TABLE "CandidatePipeline"
        ADD CONSTRAINT "CandidatePipeline_societyId_fkey"
        FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Candidate"
        ADD CONSTRAINT "Candidate_societyId_fkey"
        FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Candidate"
        ADD CONSTRAINT "Candidate_pipelineId_fkey"
        FOREIGN KEY ("pipelineId") REFERENCES "CandidatePipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "CandidateActivity"
        ADD CONSTRAINT "CandidateActivity_candidateId_fkey"
        FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 16: Workflows visuels
DO $$ BEGIN
    ALTER TABLE "Workflow"
        ADD CONSTRAINT "Workflow_societyId_fkey"
        FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "WorkflowRun"
        ADD CONSTRAINT "WorkflowRun_workflowId_fkey"
        FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================================
-- 5. INDEXES
-- ==========================================================================

-- Phase 13: Copropriete
CREATE INDEX IF NOT EXISTS "Copropriete_societyId_idx"       ON "Copropriete"("societyId");
CREATE INDEX IF NOT EXISTS "CoproLot_coproprieteId_idx"      ON "CoproLot"("coproprieteId");
CREATE INDEX IF NOT EXISTS "CoproBudget_coproprieteId_idx"   ON "CoproBudget"("coproprieteId");
CREATE INDEX IF NOT EXISTS "CoproAssembly_coproprieteId_idx" ON "CoproAssembly"("coproprieteId");
CREATE INDEX IF NOT EXISTS "CoproAssembly_date_idx"          ON "CoproAssembly"("date");
CREATE INDEX IF NOT EXISTS "CoproResolution_assemblyId_idx"  ON "CoproResolution"("assemblyId");
CREATE INDEX IF NOT EXISTS "CoproVote_resolutionId_idx"      ON "CoproVote"("resolutionId");

-- Phase 14: Location saisonniere
CREATE INDEX IF NOT EXISTS "SeasonalProperty_societyId_idx"       ON "SeasonalProperty"("societyId");
CREATE INDEX IF NOT EXISTS "SeasonalProperty_lotId_idx"           ON "SeasonalProperty"("lotId");
CREATE INDEX IF NOT EXISTS "SeasonalBooking_propertyId_idx"       ON "SeasonalBooking"("propertyId");
CREATE INDEX IF NOT EXISTS "SeasonalBooking_checkIn_idx"          ON "SeasonalBooking"("checkIn");
CREATE INDEX IF NOT EXISTS "SeasonalBooking_checkOut_idx"         ON "SeasonalBooking"("checkOut");
CREATE INDEX IF NOT EXISTS "SeasonalPricing_propertyId_idx"       ON "SeasonalPricing"("propertyId");
CREATE INDEX IF NOT EXISTS "SeasonalPricing_startDate_endDate_idx" ON "SeasonalPricing"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "SeasonalBlockedDate_propertyId_idx"   ON "SeasonalBlockedDate"("propertyId");

-- Phase 15: CRM / Pipeline candidatures
CREATE INDEX IF NOT EXISTS "CandidatePipeline_societyId_idx"  ON "CandidatePipeline"("societyId");
CREATE INDEX IF NOT EXISTS "Candidate_societyId_idx"           ON "Candidate"("societyId");
CREATE INDEX IF NOT EXISTS "Candidate_pipelineId_idx"          ON "Candidate"("pipelineId");
CREATE INDEX IF NOT EXISTS "Candidate_status_idx"              ON "Candidate"("status");
CREATE INDEX IF NOT EXISTS "CandidateActivity_candidateId_idx" ON "CandidateActivity"("candidateId");
CREATE INDEX IF NOT EXISTS "CandidateActivity_createdAt_idx"   ON "CandidateActivity"("createdAt");

-- Phase 16: Workflows visuels
CREATE INDEX IF NOT EXISTS "Workflow_societyId_idx"        ON "Workflow"("societyId");
CREATE INDEX IF NOT EXISTS "WorkflowRun_workflowId_idx"    ON "WorkflowRun"("workflowId");
CREATE INDEX IF NOT EXISTS "WorkflowRun_createdAt_idx"     ON "WorkflowRun"("createdAt");
