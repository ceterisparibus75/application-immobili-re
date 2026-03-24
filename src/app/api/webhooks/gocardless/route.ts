import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateGocardlessWebhook } from "@/lib/gocardless-sepa";
import { createNotification } from "@/actions/notifications";

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("webhook-signature") ?? "";

  try {
    if (!validateGocardlessWebhook(rawBody, signature)) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Webhook secret manquant" }, { status: 500 });
  }

  const body = JSON.parse(rawBody.toString()) as { events: GcEvent[] };

  for (const event of body.events ?? []) {
    await handleEvent(event);
  }

  return NextResponse.json({ ok: true });
}

interface GcEvent {
  id: string;
  resource_type: string;
  action: string;
  links: Record<string, string>;
  details?: { cause?: string; description?: string };
}

async function handleEvent(event: GcEvent) {
  const { resource_type, action, links } = event;

  // ── Mandats ────────────────────────────────────────────────
  if (resource_type === "mandates") {
    const mandate = await prisma.sepaMandate.findFirst({
      where: { gocardlessId: links.mandate },
    });
    if (!mandate) return;

    const statusMap: Record<string, string> = {
      active: "ACTIVE",
      submitted: "SUBMITTED",
      failed: "FAILED",
      cancelled: "CANCELLED",
      expired: "EXPIRED",
    };

    const newStatus = statusMap[action] ?? mandate.status;
    await prisma.sepaMandate.update({
      where: { id: mandate.id },
      data: { status: newStatus as import("@prisma/client").SepaMandateStatus },
    });
  }

  // ── Paiements ──────────────────────────────────────────────
  if (resource_type === "payments") {
    const invoice = await prisma.invoice.findFirst({
      where: { sepaPaymentId: links.payment },
    });
    if (!invoice) return;

    const statusMap: Record<string, string> = {
      submitted: "SUBMITTED",
      confirmed: "CONFIRMED",
      paid_out: "PAID_OUT",
      failed: "FAILED",
      cancelled: "CANCELLED",
      customer_approval_denied: "CUSTOMER_APPROVAL_DENIED",
      charged_back: "CHARGED_BACK",
    };

    const newStatus = statusMap[action];
    if (!newStatus) return;

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        sepaStatus: newStatus as import("@prisma/client").SepaPaymentStatus,
        ...(action === "confirmed" || action === "paid_out"
          ? { status: "PAYE" as import("@prisma/client").InvoiceStatus }
          : {}),
      },
    });

    // Notification propriétaire
    const society = await prisma.society.findUnique({
      where: { id: invoice.societyId },
      include: { userSocieties: { where: { role: { in: ["GESTIONNAIRE", "ADMIN_SOCIETE"] } }, take: 1 } },
    });

    if (society?.userSocieties[0]) {
      const userId = society.userSocieties[0].userId;
      if (action === "confirmed" || action === "paid_out") {
        await createNotification({
          userId,
          societyId: invoice.societyId,
          type: "PAYMENT_RECEIVED",
          title: "Prélèvement SEPA confirmé",
          message: `Le prélèvement pour la facture ${invoice.invoiceNumber} a été confirmé.`,
          link: `/facturation/${invoice.id}`,
        });
      } else if (action === "failed") {
        await createNotification({
          userId,
          societyId: invoice.societyId,
          type: "SEPA_PAYMENT_FAILED",
          title: "Échec du prélèvement SEPA",
          message: `Le prélèvement pour la facture ${invoice.invoiceNumber} a échoué. ${event.details?.description ?? ""}`,
          link: `/facturation/${invoice.id}`,
        });
      }
    }
  }
}
