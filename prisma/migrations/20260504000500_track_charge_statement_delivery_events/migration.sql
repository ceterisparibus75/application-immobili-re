-- ExtendEnum
ALTER TYPE "ChargeStatementDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "ChargeStatementDeliveryStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';
ALTER TYPE "ChargeStatementDeliveryStatus" ADD VALUE IF NOT EXISTS 'COMPLAINED';
ALTER TYPE "ChargeStatementDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_DELAYED';

-- AlterTable
ALTER TABLE "ChargeStatementDelivery"
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "bouncedAt" TIMESTAMP(3),
ADD COLUMN "complainedAt" TIMESTAMP(3),
ADD COLUMN "lastEventAt" TIMESTAMP(3),
ADD COLUMN "lastEventType" TEXT;

-- CreateTable
CREATE TABLE "ChargeStatementDeliveryEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "ChargeStatementDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargeStatementDeliveryEvent_deliveryId_idx" ON "ChargeStatementDeliveryEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "ChargeStatementDeliveryEvent_provider_eventType_idx" ON "ChargeStatementDeliveryEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "ChargeStatementDeliveryEvent_providerEventId_idx" ON "ChargeStatementDeliveryEvent"("providerEventId");

-- AddForeignKey
ALTER TABLE "ChargeStatementDeliveryEvent" ADD CONSTRAINT "ChargeStatementDeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ChargeStatementDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
