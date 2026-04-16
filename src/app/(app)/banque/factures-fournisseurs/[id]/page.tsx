import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getSupplierInvoiceById } from "@/actions/supplier-invoice";
import { prisma } from "@/lib/prisma";
import { SupplierInvoiceForm } from "./_components/supplier-invoice-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "À valider",
  VALIDATED: "Validée",
  REJECTED: "Rejetée",
  PAID: "Payée",
  ARCHIVED: "Archivée",
};

const STATUS_VARIANTS: Record<
  string,
  "warning" | "default" | "secondary" | "success" | "destructive" | "outline"
> = {
  PENDING_REVIEW: "warning",
  VALIDATED: "default",
  REJECTED: "secondary",
  PAID: "success",
  ARCHIVED: "secondary",
};

export default async function SupplierInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const [invoice, buildings, bankAccounts, categories, tenants, accountingAccounts] = await Promise.all([
    getSupplierInvoiceById(societyId, id),
    prisma.building.findMany({
      where: { societyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { societyId, isActive: true },
      select: { id: true, bankName: true, accountName: true, qontoAccountId: true },
      orderBy: { accountName: "asc" },
    }),
    prisma.chargeCategory.findMany({
      where: { societyId },
      select: { id: true, name: true, nature: true, buildingId: true },
      orderBy: { name: "asc" },
    }),
    prisma.tenant.findMany({
      where: { societyId, isActive: true },
      select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.accountingAccount.findMany({
      where: { societyId, isActive: true, type: "6" },
      select: { id: true, code: true, label: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!invoice) notFound();

  // Vérifier si un IBAN est présent (sans l'exposer côté client)
  const hasIban = !!(await prisma.supplierInvoice.findFirst({
    where: { id, societyId },
    select: { supplierIbanEncrypted: true },
  }))?.supplierIbanEncrypted;

  // Construire l'objet sûr à passer au client (sans IBAN chiffré)
  const safeInvoice = {
    id: invoice.id,
    status: invoice.status,
    reference: invoice.reference,
    source: invoice.source,
    senderEmail: invoice.senderEmail,
    emailSubject: invoice.emailSubject,
    receivedAt: invoice.receivedAt?.toISOString() ?? null,
    fileName: invoice.fileName,
    fileUrl: invoice.fileUrl,
    fileSize: invoice.fileSize,
    supplierName: invoice.supplierName,
    supplierSiret: invoice.supplierSiret,
    supplierAddress: invoice.supplierAddress,
    supplierBic: invoice.supplierBic,
    hasIban,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate?.toISOString() ?? null,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    amountHT: invoice.amountHT,
    amountVAT: invoice.amountVAT,
    amountTTC: invoice.amountTTC,
    vatRate: invoice.vatRate,
    currency: invoice.currency,
    description: invoice.description,
    periodStart: invoice.periodStart?.toISOString() ?? null,
    periodEnd: invoice.periodEnd?.toISOString() ?? null,
    aiConfidence: invoice.aiConfidence,
    aiStatus: invoice.aiStatus,
    buildingId: invoice.buildingId,
    leaseId: invoice.leaseId,
    tenantId: invoice.tenantId,
    categoryId: invoice.categoryId,
    accountingAccountId: invoice.accountingAccountId,
    chargeId: invoice.chargeId,
    paymentMethod: invoice.paymentMethod,
    paymentStatus: invoice.paymentStatus,
    paymentScheduledAt: invoice.paymentScheduledAt?.toISOString() ?? null,
    paymentExecutedAt: invoice.paymentExecutedAt?.toISOString() ?? null,
    paymentReference: invoice.paymentReference,
    bankAccountId: invoice.bankAccountId,
    qontoTransferId: invoice.qontoTransferId,
    sepaXmlUrl: invoice.sepaXmlUrl,
    rejectedAt: invoice.rejectedAt?.toISOString() ?? null,
    rejectionReason: invoice.rejectionReason,
    validatedAt: invoice.validatedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  };

  const supplierLabel = invoice.supplierName ?? invoice.fileName ?? `Facture ${invoice.reference}`;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/banque/factures-fournisseurs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
                {supplierLabel}
              </h1>
              <Badge variant={STATUS_VARIANTS[invoice.status] ?? "outline"}>
                {STATUS_LABELS[invoice.status] ?? invoice.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {invoice.source === "email"
                ? `Reçue par email${invoice.senderEmail ? ` de ${invoice.senderEmail}` : ""}`
                : "Upload manuel"}
              {invoice.invoiceNumber ? ` · N° ${invoice.invoiceNumber}` : ""}
            </p>
          </div>
        </div>
        {invoice.fileUrl && (
          <a
            href={`/api/storage/view?path=${encodeURIComponent(invoice.fileUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-4 w-4" />
              Ouvrir dans un onglet
            </Button>
          </a>
        )}
      </div>

      {/* Grille 2 colonnes — PDF sticky + formulaire défilant */}
      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        {/* Visionneuse PDF (60%) — reste visible pendant le défilement du formulaire */}
        <div className="lg:col-span-3 lg:sticky lg:top-4">
          {invoice.fileUrl ? (
            <div
              className="rounded-xl border border-border/60 overflow-hidden bg-muted/30"
              style={{ height: "calc(100vh - 120px)" }}
            >
              <iframe
                src={`/api/storage/view?path=${encodeURIComponent(invoice.fileUrl)}`}
                className="w-full h-full"
                title="Aperçu de la facture"
              />
            </div>
          ) : (
            <div
              className="rounded-xl border border-border/60 bg-muted/20 flex flex-col items-center justify-center text-center p-12"
              style={{ height: "400px" }}
            >
              <p className="text-muted-foreground text-sm">Aucun fichier PDF disponible</p>
              <p className="text-xs text-muted-foreground mt-1">{invoice.fileName}</p>
            </div>
          )}
        </div>

        {/* Formulaire (40%) — défile indépendamment */}
        <div className="lg:col-span-2 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pb-4">
          <SupplierInvoiceForm
            invoice={safeInvoice}
            societyId={societyId}
            buildings={buildings}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              nature: c.nature,
              buildingId: c.buildingId ?? null,
            }))}
            bankAccounts={bankAccounts.map((ba) => ({
              id: ba.id,
              bankName: ba.bankName,
              accountName: ba.accountName,
              qontoAccountId: ba.qontoAccountId,
            }))}
            tenants={tenants.map((t) => ({
              id: t.id,
              label: t.entityType === "PERSONNE_MORALE"
                ? (t.companyName ?? "")
                : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
            }))}
            accountingAccounts={accountingAccounts.map((a) => ({
              id: a.id,
              code: a.code,
              label: a.label,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
