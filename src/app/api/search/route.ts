import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSocietyRouteContext } from "@/lib/api-society";

export interface SearchResult {
  id: string;
  type:
    | "building"
    | "lot"
    | "tenant"
    | "lease"
    | "invoice"
    | "contact"
    | "document"
    | "bankAccount"
    | "charge"
    | "supplierInvoice"
    | "ticket"
    | "reportSchedule";
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
}

export async function GET(req: NextRequest) {
  const context = await requireActiveSocietyRouteContext();
  if (context instanceof NextResponse) return context;

  const { societyId } = context;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const typeFilter = url.searchParams.get("type")?.trim() ?? "";
  const results: SearchResult[] = [];

  // Immeubles
  if (!typeFilter || typeFilter === "building") {
    const buildings = await prisma.building.findMany({
      where: {
        societyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { addressLine1: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: { id: true, name: true, addressLine1: true, city: true },
    });
    for (const b of buildings) {
      results.push({
        id: b.id, type: "building",
        title: b.name, subtitle: [b.addressLine1, b.city].filter(Boolean).join(", "),
        href: `/patrimoine/immeubles/${b.id}`,
      });
    }
  }

  // Lots
  if (!typeFilter || typeFilter === "lot") {
    const lots = await prisma.lot.findMany({
      where: {
        building: { societyId },
        OR: [
          { number: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      include: { building: { select: { name: true } } },
    });
    for (const l of lots) {
      results.push({
        id: l.id, type: "lot",
        title: l.number ?? l.id,
        subtitle: l.building.name,
        href: `/patrimoine/immeubles/${l.buildingId}/lots/${l.id}`,
      });
    }
  }

  // Locataires
  if (!typeFilter || typeFilter === "tenant") {
    const tenants = await prisma.tenant.findMany({
      where: {
        societyId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
    });
    for (const t of tenants) {
      results.push({
        id: t.id, type: "tenant",
        title: t.entityType === "PERSONNE_MORALE"
          ? (t.companyName ?? t.id)
          : [t.firstName, t.lastName].filter(Boolean).join(" "),
        subtitle: t.email ?? undefined,
        href: `/locataires/${t.id}`,
      });
    }
  }

  // Factures
  if (!typeFilter || typeFilter === "invoice") {
    const invoices = await prisma.invoice.findMany({
      where: {
        societyId,
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { tenant: { firstName: { contains: q, mode: "insensitive" } } },
          { tenant: { lastName: { contains: q, mode: "insensitive" } } },
          { tenant: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 3,
      include: { tenant: { select: { firstName: true, lastName: true, companyName: true } } },
    });
    for (const inv of invoices) {
      const tenantName = inv.tenant.companyName ?? [inv.tenant.firstName, inv.tenant.lastName].filter(Boolean).join(" ");
      results.push({
        id: inv.id, type: "invoice",
        title: inv.invoiceNumber ?? "Brouillon",
        subtitle: tenantName,
        href: `/facturation/${inv.id}`,
        meta: `${inv.totalTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`,
      });
    }
  }

  // Baux
  if (!typeFilter || typeFilter === "lease") {
    const leases = await prisma.lease.findMany({
      where: {
        societyId,
        OR: [
          { leaseNumber: { contains: q, mode: "insensitive" } },
          { tenant: { firstName: { contains: q, mode: "insensitive" } } },
          { tenant: { lastName: { contains: q, mode: "insensitive" } } },
          { tenant: { companyName: { contains: q, mode: "insensitive" } } },
          { lot: { number: { contains: q, mode: "insensitive" } } },
          { lot: { building: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      take: 3,
      include: {
        tenant: { select: { firstName: true, lastName: true, companyName: true } },
        lot: { select: { number: true, building: { select: { name: true } } } },
      },
    });
    for (const lease of leases) {
      const tenantName = lease.tenant.companyName ?? [lease.tenant.firstName, lease.tenant.lastName].filter(Boolean).join(" ");
      results.push({
        id: lease.id,
        type: "lease",
        title: lease.leaseNumber ?? `Bail ${lease.lot.number ?? lease.id}`,
        subtitle: [tenantName, lease.lot.building.name].filter(Boolean).join(" - "),
        href: `/baux/${lease.id}`,
      });
    }
  }

  // Contacts
  if (!typeFilter || typeFilter === "contact") {
    const contacts = await prisma.contact.findMany({
      where: {
        societyId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: { id: true, name: true, email: true, company: true },
    });
    for (const c of contacts) {
      results.push({
        id: c.id, type: "contact",
        title: c.name, subtitle: c.company ?? c.email ?? undefined,
        href: `/contacts/${c.id}`,
      });
    }
  }

  // Documents
  if (!typeFilter || typeFilter === "document") {
    const documents = await prisma.document.findMany({
      where: {
        societyId,
        OR: [
          { fileName: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: { id: true, fileName: true, category: true, description: true },
    });
    for (const doc of documents) {
      results.push({
        id: doc.id,
        type: "document",
        title: doc.fileName,
        subtitle: doc.category ?? doc.description ?? undefined,
        href: `/documents?documentId=${encodeURIComponent(doc.id)}`,
      });
    }
  }

  // Comptes bancaires
  if (!typeFilter || typeFilter === "bankAccount") {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        societyId,
        OR: [
          { accountName: { contains: q, mode: "insensitive" } },
          { bankName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: {
        id: true,
        accountName: true,
        bankName: true,
        currentBalance: true,
      },
    });
    for (const account of bankAccounts) {
      results.push({
        id: account.id,
        type: "bankAccount",
        title: account.accountName,
        subtitle: account.bankName,
        href: `/banque/${account.id}`,
        meta: account.currentBalance.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
      });
    }
  }

  // Charges
  if (!typeFilter || typeFilter === "charge") {
    const charges = await prisma.charge.findMany({
      where: {
        societyId,
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { supplierName: { contains: q, mode: "insensitive" } },
          { category: { name: { contains: q, mode: "insensitive" } } },
          { building: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 3,
      select: {
        id: true,
        description: true,
        amount: true,
        supplierName: true,
        building: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    for (const charge of charges) {
      results.push({
        id: charge.id,
        type: "charge",
        title: charge.description,
        subtitle: [charge.supplierName, charge.building.name, charge.category.name].filter(Boolean).join(" - "),
        href: `/charges/${charge.id}`,
        meta: charge.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
      });
    }
  }

  // Factures fournisseurs
  if (!typeFilter || typeFilter === "supplierInvoice") {
    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: {
        societyId,
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { fileName: { contains: q, mode: "insensitive" } },
          { supplierName: { contains: q, mode: "insensitive" } },
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { emailSubject: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 3,
      select: {
        id: true,
        reference: true,
        fileName: true,
        supplierName: true,
        invoiceNumber: true,
        amountTTC: true,
        status: true,
      },
    });
    for (const invoice of supplierInvoices) {
      results.push({
        id: invoice.id,
        type: "supplierInvoice",
        title: invoice.reference ?? invoice.invoiceNumber ?? invoice.fileName,
        subtitle: invoice.supplierName ?? invoice.fileName,
        href: `/banque/factures-fournisseurs/${invoice.id}`,
        meta: invoice.amountTTC != null
          ? invoice.amountTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
          : invoice.status,
      });
    }
  }

  // Tickets locataires
  if (!typeFilter || typeFilter === "ticket") {
    const tickets = await prisma.ticket.findMany({
      where: {
        societyId,
        OR: [
          { ticketNumber: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { tenant: { firstName: { contains: q, mode: "insensitive" } } },
          { tenant: { lastName: { contains: q, mode: "insensitive" } } },
          { tenant: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 3,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        tenant: { select: { firstName: true, lastName: true, companyName: true } },
      },
    });
    for (const ticket of tickets) {
      const tenantName = ticket.tenant.companyName
        ?? [ticket.tenant.firstName, ticket.tenant.lastName].filter(Boolean).join(" ");
      results.push({
        id: ticket.id,
        type: "ticket",
        title: `${ticket.ticketNumber} - ${ticket.subject}`,
        subtitle: tenantName || undefined,
        href: `/tickets/${ticket.id}`,
        meta: ticket.status,
      });
    }
  }

  // Planifications de rapports
  if (!typeFilter || typeFilter === "reportSchedule") {
    const schedules = await prisma.reportSchedule.findMany({
      where: {
        societyId,
        name: { contains: q, mode: "insensitive" },
      },
      take: 3,
      select: {
        id: true,
        name: true,
        frequency: true,
        isActive: true,
      },
    });
    for (const schedule of schedules) {
      results.push({
        id: schedule.id,
        type: "reportSchedule",
        title: schedule.name,
        subtitle: `Rapport ${schedule.frequency.toLowerCase()}`,
        href: "/rapports/planification",
        meta: schedule.isActive ? "Actif" : "Inactif",
      });
    }
  }

  return NextResponse.json({ data: results });
}
