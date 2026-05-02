import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import DocumentsTabs from "./_components/documents-tabs";

export const metadata = { title: "Mes documents" };

export default async function PortalDocumentsPage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  const tenants = await prisma.tenant.findMany({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);

  const leases = await prisma.lease.findMany({
    where: { tenantId: { in: tenantIds } },
    select: {
      id: true,
      status: true,
      startDate: true,
      leaseFileUrl: true,
      lot: { select: { number: true, building: { select: { name: true, city: true } } } },
      society: { select: { name: true } },
    },
    orderBy: { startDate: "desc" },
  });

  const ownLeaseIds = leases.map((l) => l.id);

  const gedDocuments = await prisma.document.findMany({
    where: {
      OR: [
        { tenantId: { in: tenantIds } },
        ...(ownLeaseIds.length > 0 ? [{ leaseId: { in: ownLeaseIds } }] : []),
      ],
    },
    select: {
      id: true, fileName: true, fileUrl: true, category: true,
      description: true, createdAt: true, leaseId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: { in: tenantIds }, status: { not: "BROUILLON" } },
    select: {
      id: true, invoiceNumber: true, invoiceType: true, status: true,
      totalHT: true, totalTTC: true, issueDate: true, dueDate: true, fileUrl: true,
      payments: { select: { paidAt: true }, take: 1, orderBy: { paidAt: "desc" } },
    },
    orderBy: { issueDate: "desc" },
    take: 100,
  });

  // Shape data — convert Date to ISO strings for Client Component serialisation
  const shapedLeases = leases.map((lease) => ({
    id: lease.id,
    status: lease.status,
    startDate: lease.startDate.toISOString(),
    leaseFileUrl: lease.leaseFileUrl,
    lotName: `${lease.lot.building.name} — Lot ${lease.lot.number}`,
    societyName: lease.society?.name ?? null,
    docs: gedDocuments
      .filter(
        (d) => d.leaseId === lease.id && !["facture", "quittance"].includes(d.category ?? "")
      )
      .map((d) => ({
        id: d.id, fileName: d.fileName, fileUrl: d.fileUrl,
        category: d.category, description: d.description,
        createdAt: d.createdAt.toISOString(),
      })),
  }));

  const standaloneGedDocs = gedDocuments
    .filter((d) => !d.leaseId)
    .map((d) => ({
      id: d.id, fileName: d.fileName, fileUrl: d.fileUrl,
      category: d.category, description: d.description,
      createdAt: d.createdAt.toISOString(),
    }));

  const toInvoiceRow = (inv: (typeof invoices)[number]) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    totalHT: inv.totalHT,
    totalTTC: inv.totalTTC,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    fileUrl: inv.fileUrl,
    paidAt: inv.payments?.[0]?.paidAt?.toISOString() ?? null,
  });

  const appelLoyer = invoices.filter((i) => i.invoiceType === "APPEL_LOYER").map(toInvoiceRow);
  const quittances = invoices.filter((i) => i.invoiceType === "QUITTANCE").map(toInvoiceRow);

  return (
    <div className="space-y-4">
      <Link
        href="/portal/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Accueil
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes documents</h1>
        <p className="text-sm text-muted-foreground">
          Consultez vos baux, factures et quittances
        </p>
      </div>

      <DocumentsTabs
        leases={shapedLeases}
        standaloneGedDocs={standaloneGedDocs}
        appelLoyer={appelLoyer}
        quittances={quittances}
      />
    </div>
  );
}
