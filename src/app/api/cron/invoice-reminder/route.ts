import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceReminderEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Factures en attente dont la date d'échéance est dépassée
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["EN_ATTENTE", "EN_RETARD"] },
        dueDate: { lt: now },
      },
      include: {
        tenant: {
          select: {
            id: true,
            email: true,
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
        lease: {
          select: {
            society: { select: { name: true } },
          },
        },
      },
    });

    let sent = 0;

    for (const invoice of overdueInvoices) {
      if (!invoice.tenant) continue;

      const tenantName =
        invoice.tenant.entityType === "PERSONNE_MORALE"
          ? (invoice.tenant.companyName ?? "")
          : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim();

      // Passer en EN_RETARD si encore EN_ATTENTE
      if (invoice.status === "EN_ATTENTE") {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "EN_RETARD" },
        });
      }

      await sendInvoiceReminderEmail({
        to: invoice.tenant.email,
        tenantName,
        invoiceNumber: invoice.invoiceNumber ?? invoice.id,
        amount: invoice.totalTTC ?? invoice.totalHT,
        dueDate: invoice.dueDate.toLocaleDateString("fr-FR"),
        societyName: invoice.lease?.society?.name ?? "",
      });

      sent++;
    }

    return NextResponse.json({ success: true, sent, total: overdueInvoices.length });
  } catch (error) {
    console.error("[cron/invoice-reminder]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
