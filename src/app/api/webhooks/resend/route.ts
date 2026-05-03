import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { enforceWebhookRateLimit } from "@/lib/webhook-rate-limit";
import { applyResendDeliveryEvent } from "@/lib/email-delivery-proof";

export const dynamic = "force-dynamic";

type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

function verifyResendWebhook(rawBody: string, request: NextRequest): ResendWebhookEvent | null {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET non configuré");
    return null;
  }

  const headers = {
    "svix-id": request.headers.get("svix-id") ?? request.headers.get("webhook-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? request.headers.get("webhook-signature") ?? "",
  };

  try {
    return new Webhook(secret).verify(rawBody, headers) as ResendWebhookEvent;
  } catch {
    console.error("[resend-webhook] Signature webhook invalide");
    return null;
  }
}

function providerMessageId(event: ResendWebhookEvent): string | null {
  const data = event.data ?? {};
  const id = data.email_id ?? data.emailId ?? data.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function eventDate(event: ResendWebhookEvent): Date {
  const raw = event.created_at;
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function statusPatch(type: string, occurredAt: Date) {
  switch (type) {
    case "email.delivered":
      return { status: "DELIVERED" as const, deliveredAt: occurredAt };
    case "email.bounced":
      return { status: "BOUNCED" as const, bouncedAt: occurredAt };
    case "email.complained":
      return { status: "COMPLAINED" as const, complainedAt: occurredAt };
    case "email.delivery_delayed":
      return { status: "DELIVERY_DELAYED" as const };
    default:
      return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await enforceWebhookRateLimit(request, "resend");
  if (rateLimitResponse) return rateLimitResponse;

  const rawBody = await request.text();
  const event = verifyResendWebhook(rawBody, request);
  if (!event) {
    const status = env.RESEND_WEBHOOK_SECRET ? 401 : 500;
    return NextResponse.json({ error: "Webhook Resend non autorisé" }, { status });
  }

  const messageId = providerMessageId(event);
  const patch = statusPatch(event.type, eventDate(event));
  if (!messageId || !patch) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const providerEventId = request.headers.get("svix-id") ?? request.headers.get("webhook-id") ?? null;
  const genericProofResult = await applyResendDeliveryEvent({ providerEventId, event });

  const deliveries = await prisma.chargeStatementDelivery.findMany({
    where: { provider: "resend", providerMessageId: messageId },
    select: { id: true },
  });

  if (deliveries.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, genericMatched: genericProofResult.matched });
  }

  const occurredAt = eventDate(event);
  const deliveryIds = deliveries.map((delivery) => delivery.id);

  await prisma.chargeStatementDelivery.updateMany({
    where: { id: { in: deliveryIds } },
    data: {
      ...patch,
      lastEventAt: occurredAt,
      lastEventType: event.type,
    },
  });

  const payload = JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;
  await prisma.chargeStatementDeliveryEvent.createMany({
    data: deliveryIds.map((deliveryId) => ({
      deliveryId,
      provider: "resend",
      providerEventId,
      eventType: event.type,
      occurredAt,
      payload,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, matched: deliveryIds.length, genericMatched: genericProofResult.matched });
}
