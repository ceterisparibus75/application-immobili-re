-- CreateEnum
CREATE TYPE "MaintenanceNature" AS ENUM ('ENTRETIEN_COURANT', 'GROSSE_REPARATION', 'AMELIORATION');

-- AlterTable: add column with default for backfill (existing rows = ENTRETIEN_COURANT)
ALTER TABLE "Maintenance"
  ADD COLUMN "nature" "MaintenanceNature" NOT NULL DEFAULT 'ENTRETIEN_COURANT';

-- CreateIndex
CREATE INDEX "Maintenance_nature_idx" ON "Maintenance"("nature");
