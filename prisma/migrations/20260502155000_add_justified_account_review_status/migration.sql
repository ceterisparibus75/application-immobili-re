-- Add an intermediate review state for accounts justified by accounting staff
-- but not yet supervised/reviewed.
ALTER TYPE "AccountReviewStatus" ADD VALUE IF NOT EXISTS 'JUSTIFIED';
