import { createHash } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type EmailDeliveryProofContext = {
  societyId?: string | null;
  sentById?: string | null;
  entityType: string;
  entityId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  invoiceId?: string | null;
  recipientName?: string | null;
  evidence?: Prisma.InputJsonValue;
};

export type EmailAttachmentEvidence = {
  filename: string;
  content: Buffer;
  mimeType?: string;
  storagePath?: string | null;
};

export type ResendDeliveryEvent = {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function messageId(event: ResendDeliveryEvent): string | null {
  const raw = event.data?.email_id ?? event.data?.emailId ?? event.data?.id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function occurredAt(event: ResendDeliveryEvent): Date {
  const date = event.created_at ? new Date(event.created_at) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function statusPatch(type: string, date: Date) {
  switch (type) {
    case "email.delivered":
      return { status: "DELIVERED" as const, deliveredAt: date };
    case "email.bounced":
      return { status: "BOUNCED" as const, bouncedAt: date };
    case "email.complained":
      return { status: "COMPLAINED" as const, complainedAt: date };
    case "email.delivery_delayed":
      return { status: "DELIVERY_DELAYED" as const, deliveryDelayedAt: date };
    default:
      return null;
  }
}

export async function createEmailDeliveryProof(input: {
  societyId?: string | null;
  sentById?: string | null;
  entityType: string;
  entityId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  invoiceId?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  html: string;
  providerMessageId?: string | null;
  replyTo?: string | null;
  bcc?: string[];
  attachments?: EmailAttachmentEvidence[];
  evidence?: Prisma.InputJsonValue;
  status?: "SENT" | "DELIVERED" | "BOUNCED" | "COMPLAINED" | "DELIVERY_DELAYED" | "FAILED";
  errorMessage?: string | null;
}) {
  const attachment = input.attachments?.[0] ?? null;
  return prisma.emailDeliveryProof.create({
    data: {
      societyId: input.societyId ?? null,
      sentById: input.sentById ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      tenantId: input.tenantId ?? null,
      leaseId: input.leaseId ?? null,
      invoiceId: input.invoiceId ?? null,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName ?? null,
      subject: input.subject,
      replyTo: input.replyTo ?? null,
      bcc: input.bcc?.length ? input.bcc : undefined,
      provider: "resend",
      providerMessageId: input.providerMessageId ?? null,
      status: input.status ?? "SENT",
      errorMessage: input.errorMessage ?? null,
      htmlSha256: sha256(input.html),
      htmlSnapshot: input.html,
      attachmentFileName: attachment?.filename ?? null,
      attachmentMimeType: attachment ? (attachment.mimeType ?? "application/pdf") : null,
      attachmentSha256: attachment ? sha256(attachment.content) : null,
      attachmentSizeBytes: attachment?.content.length ?? null,
      attachmentStoragePath: attachment?.storagePath ?? null,
      evidence: input.evidence,
    },
  });
}

export async function applyResendDeliveryEvent(input: {
  providerEventId?: string | null;
  event: ResendDeliveryEvent;
}): Promise<{ matched: number }> {
  const providerMessageId = messageId(input.event);
  const date = occurredAt(input.event);
  const patch = statusPatch(input.event.type, date);
  if (!providerMessageId || !patch) return { matched: 0 };

  const proofs = await prisma.emailDeliveryProof.findMany({
    where: { provider: "resend", providerMessageId },
    select: { id: true },
  });
  if (proofs.length === 0) return { matched: 0 };

  const proofIds = proofs.map((proof) => proof.id);
  await prisma.emailDeliveryProof.updateMany({
    where: { id: { in: proofIds } },
    data: {
      ...patch,
      lastEventAt: date,
      lastEventType: input.event.type,
    },
  });

  await prisma.emailDeliveryEvent.createMany({
    data: proofIds.map((proofId) => ({
      proofId,
      provider: "resend",
      providerEventId: input.providerEventId ?? null,
      eventType: input.event.type,
      occurredAt: date,
      payload: safeJson(input.event),
    })),
    skipDuplicates: true,
  });

  return { matched: proofIds.length };
}
