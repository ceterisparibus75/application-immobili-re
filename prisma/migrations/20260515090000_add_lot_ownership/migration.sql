-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('PLEINE_PROPRIETE', 'USUFRUIT', 'NUE_PROPRIETE');

-- CreateTable
CREATE TABLE "LotOwnership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "proprietaireId" TEXT NOT NULL,
    "type" "OwnershipType" NOT NULL,
    "share" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isViager" BOOLEAN NOT NULL DEFAULT false,
    "usufruitierBirthDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "LotOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LotOwnership_societyId_idx" ON "LotOwnership"("societyId");

-- CreateIndex
CREATE INDEX "LotOwnership_lotId_idx" ON "LotOwnership"("lotId");

-- CreateIndex
CREATE INDEX "LotOwnership_proprietaireId_idx" ON "LotOwnership"("proprietaireId");

-- CreateIndex
CREATE INDEX "LotOwnership_lotId_type_idx" ON "LotOwnership"("lotId", "type");

-- CreateIndex
CREATE INDEX "LotOwnership_lotId_startDate_endDate_idx" ON "LotOwnership"("lotId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "LotOwnership" ADD CONSTRAINT "LotOwnership_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotOwnership" ADD CONSTRAINT "LotOwnership_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotOwnership" ADD CONSTRAINT "LotOwnership_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "Proprietaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill : chaque lot existant dont la société a un proprietaireId
-- reçoit une ligne PLEINE_PROPRIETE share=1, démarrant à la date d'acquisition
-- du building si elle existe, sinon à la création du lot.
INSERT INTO "LotOwnership" (
    "id",
    "createdAt",
    "updatedAt",
    "societyId",
    "lotId",
    "proprietaireId",
    "type",
    "share",
    "startDate"
)
SELECT
    'lo_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    NOW(),
    NOW(),
    b."societyId",
    l."id",
    s."proprietaireId",
    'PLEINE_PROPRIETE',
    1,
    COALESCE(b."acquisitionDate", l."createdAt")
FROM "Lot" l
JOIN "Building" b ON b."id" = l."buildingId"
JOIN "Society" s ON s."id" = b."societyId"
WHERE s."proprietaireId" IS NOT NULL;
