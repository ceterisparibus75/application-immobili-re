-- CreateEnum
CREATE TYPE "EmailDeliveryProofStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'DELIVERY_DELAYED', 'FAILED');

-- CreateTable
CREATE TABLE "EmailDeliveryProof" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "societyId" TEXT,
    "sentById" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "tenantId" TEXT,
    "leaseId" TEXT,
    "invoiceId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "replyTo" TEXT,
    "bcc" JSONB,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "status" "EmailDeliveryProofStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "deliveryDelayedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastEventType" TEXT,
    "htmlSha256" TEXT,
    "htmlSnapshot" TEXT,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSha256" TEXT,
    "attachmentSizeBytes" INTEGER,
    "attachmentStoragePath" TEXT,
    "evidence" JSONB,

    CONSTRAINT "EmailDeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proofId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDeliveryProof_societyId_idx" ON "EmailDeliveryProof"("societyId");
CREATE INDEX "EmailDeliveryProof_sentById_idx" ON "EmailDeliveryProof"("sentById");
CREATE INDEX "EmailDeliveryProof_entityType_entityId_idx" ON "EmailDeliveryProof"("entityType", "entityId");
CREATE INDEX "EmailDeliveryProof_tenantId_idx" ON "EmailDeliveryProof"("tenantId");
CREATE INDEX "EmailDeliveryProof_leaseId_idx" ON "EmailDeliveryProof"("leaseId");
CREATE INDEX "EmailDeliveryProof_invoiceId_idx" ON "EmailDeliveryProof"("invoiceId");
CREATE INDEX "EmailDeliveryProof_providerMessageId_idx" ON "EmailDeliveryProof"("providerMessageId");
CREATE INDEX "EmailDeliveryProof_status_idx" ON "EmailDeliveryProof"("status");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_proofId_idx" ON "EmailDeliveryEvent"("proofId");
CREATE INDEX "EmailDeliveryEvent_provider_eventType_idx" ON "EmailDeliveryEvent"("provider", "eventType");
CREATE INDEX "EmailDeliveryEvent_providerEventId_idx" ON "EmailDeliveryEvent"("providerEventId");
CREATE UNIQUE INDEX "EmailDeliveryEvent_proofId_providerEventId_key" ON "EmailDeliveryEvent"("proofId", "providerEventId");

-- AddForeignKey
ALTER TABLE "EmailDeliveryProof" ADD CONSTRAINT "EmailDeliveryProof_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryProof" ADD CONSTRAINT "EmailDeliveryProof_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "EmailDeliveryProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;
