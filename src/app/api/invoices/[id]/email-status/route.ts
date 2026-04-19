import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

const STATUS_LABELS: Record<string, string> = {
  delivered: "Livré",
  bounced: "Rejeté",
  spam_complaint: "Spam",
  opened: "Ouvert",
  clicked: "Cliqué",
  sent: "Envoyé",
  queued: "En file",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireActiveSocietyRouteContext();
    if (context instanceof NextResponse) return context;

    const { societyId } = context;

    const invoice = await prisma.invoice.findFirst({
      where: { id, societyId },
      select: { resendEmailId: true, sentAt: true, emailDeliveryStatus: true },
    });
    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    if (!invoice.resendEmailId) return NextResponse.json({ status: null, label: null });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ status: null, label: null });

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.get(invoice.resendEmailId);

    if (error || !data) {
      return NextResponse.json({ status: "sent", label: "Envoyé", sentAt: invoice.sentAt });
    }

    // last_event is the most recent delivery event
    const rawStatus = (data as { last_event?: string }).last_event ?? "sent";
    const label = STATUS_LABELS[rawStatus] ?? rawStatus;

    // Persist the status for caching
    if (rawStatus !== invoice.emailDeliveryStatus) {
      await prisma.invoice.update({
        where: { id },
        data: { emailDeliveryStatus: rawStatus },
      });
    }

    return NextResponse.json({ status: rawStatus, label, sentAt: invoice.sentAt });
  } catch (err) {
    console.error("[email-status]", err);
    return NextResponse.json({ status: null, label: null });
  }
}
