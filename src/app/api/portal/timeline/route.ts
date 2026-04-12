import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import type { TimelineEvent } from "@/components/portal/lease-timeline";

export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Non authentifié" } }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });

  if (tenants.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const tenantIds = tenants.map((t: { id: string }) => t.id);

  // Collect events from multiple sources in parallel
  const [leases, invoices, tickets] = await Promise.all([
    // Active leases
    prisma.lease.findMany({
      where: { tenantId: { in: tenantIds }, status: "EN_COURS" },
      select: { id: true, startDate: true, endDate: true, lot: { select: { number: true, building: { select: { name: true } } } } },
    }),
    // Recent invoices (last 6 months)
    prisma.invoice.findMany({
      where: {
        tenantId: { in: tenantIds },
        issueDate: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, invoiceNumber: true, totalTTC: true, status: true, issueDate: true, dueDate: true },
      orderBy: { issueDate: "desc" },
      take: 20,
    }),
    // Recent tickets
    prisma.ticket.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true, subject: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const events: TimelineEvent[] = [];

  // Lease events
  for (const lease of leases) {
    events.push({
      id: `lease-start-${lease.id}`,
      type: "lease_start",
      title: `Début du bail — ${lease.lot.building.name}, Lot ${lease.lot.number}`,
      date: lease.startDate.toISOString(),
      status: "success",
    });
    if (lease.endDate && lease.endDate > new Date()) {
      events.push({
        id: `lease-end-${lease.id}`,
        type: "renewal",
        title: `Fin de bail prévue — Lot ${lease.lot.number}`,
        description: "Pensez à préparer le renouvellement ou la résiliation",
        date: lease.endDate.toISOString(),
        status: "info",
      });
    }
  }

  // Invoice events
  for (const inv of invoices) {
    const statusMap: Record<string, TimelineEvent["status"]> = {
      PAYE: "success",
      PARTIELLEMENT_PAYE: "success",
      EN_ATTENTE: "warning",
      EN_RETARD: "error",
      BROUILLON: "info",
      ANNULEE: "info",
    };
    events.push({
      id: `invoice-${inv.id}`,
      type: inv.status === "PAYE" || inv.status === "PARTIELLEMENT_PAYE" ? "payment" : "invoice",
      title: inv.status === "PAYE"
        ? `Paiement reçu — Facture ${inv.invoiceNumber ?? ""}`
        : `Facture ${inv.invoiceNumber ?? ""} — ${inv.totalTTC.toFixed(2)} €`,
      description: inv.status === "EN_RETARD" ? "Cette facture est en retard de paiement" : undefined,
      date: inv.issueDate.toISOString(),
      status: statusMap[inv.status] ?? "info",
    });
  }

  // Ticket events
  for (const ticket of tickets) {
    events.push({
      id: `ticket-${ticket.id}`,
      type: "ticket",
      title: `Demande : ${ticket.subject}`,
      description: ticket.status === "RESOLU" ? "Résolue" : ticket.status === "EN_COURS" ? "En cours de traitement" : "En attente",
      date: ticket.createdAt.toISOString(),
      status: ticket.status === "RESOLU" ? "success" : ticket.status === "EN_COURS" ? "info" : "warning",
    });
  }

  // Sort by date descending
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ data: events.slice(0, 25) });
}
