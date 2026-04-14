import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parsePaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  Euro,
  Eye,
  AlertCircle,
} from "lucide-react";
import { SupplierInvoicesFilters } from "./_components/supplier-invoices-filters";

export const metadata = { title: "Factures fournisseurs" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

export default async function FacturesFournisseursPage({ searchParams }: PageProps) {
  const h = await headers();
  const societyId = h.get("x-society-id");
  if (!societyId) redirect("/societes");

  const resolvedParams = await searchParams;
  const pagination = parsePaginationParams(resolvedParams);
  const statusFilter =
    typeof resolvedParams.status === "string" ? resolvedParams.status : undefined;

  const page = pagination.page;
  const pageSize = pagination.pageSize;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { societyId };
  if (statusFilter) where.status = statusFilter;
  if (pagination.search) {
    const q = pagination.search;
    where.OR = [
      { supplierName: { contains: q, mode: "insensitive" } },
      { invoiceNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [invoices, total, kpis] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      include: {
        building: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.supplierInvoice.count({ where }),
    Promise.all([
      prisma.supplierInvoice.count({ where: { societyId } }),
      prisma.supplierInvoice.count({ where: { societyId, status: "PENDING_REVIEW" } }),
      prisma.supplierInvoice.count({
        where: { societyId, status: "VALIDATED", createdAt: { gte: startOfMonth } },
      }),
      prisma.supplierInvoice.aggregate({
        where: { societyId, status: "PENDING_REVIEW" },
        _sum: { amountTTC: true },
      }),
    ]),
  ]);

  const [totalCount, pendingCount, validatedThisMonth, pendingAmountAgg] = kpis;
  const pendingAmount = pendingAmountAgg._sum.amountTTC ?? 0;

  const isEmpty = total === 0 && !pagination.search && !statusFilter;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">
            Factures fournisseurs
          </h1>
          <p className="text-muted-foreground">
            {totalCount} facture{totalCount !== 1 ? "s" : ""} reçue{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/banque/factures-fournisseurs/nouveau">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" />
            Uploader une facture
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total reçues</p>
            </div>
            <p className="text-xl font-bold text-[var(--color-brand-deep)]">{totalCount}</p>
            <p className="text-xs text-muted-foreground">toutes périodes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-[var(--color-status-caution)]" />
              <p className="text-xs text-muted-foreground">En attente de validation</p>
            </div>
            <p className="text-xl font-bold text-[var(--color-status-caution)]">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">à traiter</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-status-positive)]" />
              <p className="text-xs text-muted-foreground">Validées ce mois</p>
            </div>
            <p className="text-xl font-bold text-[var(--color-status-positive)]">
              {validatedThisMonth}
            </p>
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-4 w-4 text-[var(--color-status-negative)]" />
              <p className="text-xs text-muted-foreground">Montant en attente</p>
            </div>
            <p className="text-xl font-bold text-[var(--color-status-negative)]">
              {formatCurrency(pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground">à payer</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <SupplierInvoicesFilters
        currentSearch={pagination.search}
        currentStatus={statusFilter}
      />

      {/* Contenu */}
      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand-light)] mb-4">
              <FileText className="h-7 w-7 text-[var(--color-brand-blue)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">
              Aucune facture fournisseur
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Uploadez vos factures manuellement ou configurez la réception automatique par email.
            </p>
            <div className="flex gap-3">
              <Link href="/parametres/facturation">
                <Button variant="outline" size="sm">
                  Configurer l&apos;email de réception
                </Button>
              </Link>
              <Link href="/banque/factures-fournisseurs/nouveau">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Uploader une facture
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tableau */}
          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Aucune facture ne correspond aux filtres sélectionnés.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          Date réception
                        </th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          Fournisseur
                        </th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          N° facture
                        </th>
                        <th className="text-right font-medium text-muted-foreground px-4 py-3">
                          Montant TTC
                        </th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          Immeuble
                        </th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          Statut
                        </th>
                        <th className="text-right font-medium text-muted-foreground px-4 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {invoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(invoice.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--color-brand-deep)]">
                            {invoice.supplierName ?? (
                              <span className="text-muted-foreground italic">Inconnu</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {invoice.invoiceNumber ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {invoice.amountTTC != null
                              ? formatCurrency(invoice.amountTTC)
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {invoice.building?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANTS[invoice.status] ?? "outline"}>
                              {STATUS_LABELS[invoice.status] ?? invoice.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/banque/factures-fournisseurs/${invoice.id}`}>
                              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs">
                                <Eye className="h-3.5 w-3.5" />
                                Voir
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                {skip + 1}–{Math.min(skip + pageSize, total)} sur {total} facture
                {total !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/banque/factures-fournisseurs?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}${pagination.search ? `&search=${pagination.search}` : ""}`}
                  >
                    <Button variant="outline" size="sm">
                      Précédent
                    </Button>
                  </Link>
                )}
                {skip + pageSize < total && (
                  <Link
                    href={`/banque/factures-fournisseurs?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}${pagination.search ? `&search=${pagination.search}` : ""}`}
                  >
                    <Button variant="outline" size="sm">
                      Suivant
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
