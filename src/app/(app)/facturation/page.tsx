import { Suspense } from "react";
import { getInvoices } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Euro,
  FilePlus2,
  Mail,
  Plus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { FacturationTabs } from "./_components/facturation-tabs";
import { ExportFactures } from "@/components/exports/export-factures";
import {
  formatCurrencyAmountFr,
  isIssuedInvoiceForBillingKpi,
  sumInvoiceTotalTTC,
} from "@/lib/invoice-kpis";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const metadata = { title: "Facturation" };

type FacturationTab = "a-traiter" | "brouillons" | "factures" | "relances" | "quittances";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function parseFacturationTab(value: string | string[] | undefined): FacturationTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "factures") return "factures";
  if (raw === "brouillons") return "brouillons";
  if (raw === "a-envoyer" || raw === "envoi") return "a-traiter";
  if (raw === "relances" || raw === "en-retard" || raw === "retard") return "relances";
  if (raw === "quittances") return "quittances";
  return "a-traiter";
}

async function getOverdueInvoices(societyId: string) {
  return prisma.invoice.findMany({
    where: {
      societyId,
      // RELANCEE inclus : une facture relancée reste impayée tant qu'elle n'a
      // pas basculé en PAYE / ANNULEE / IRRECOUVRABLE — sinon elle disparaîtrait
      // de la vue "en retard" dès le 1er envoi de relance.
      status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE"] },
      invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
      dueDate: { lt: new Date() },
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalTTC: true,
      dueDate: true,
      payments: { select: { amount: true } },
      lease: {
        select: {
          tenant: {
            select: {
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
  });
}

export default async function FacturationPage({ searchParams }: PageProps) {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const [invoices, overdueInvoices] = await Promise.all([
    getInvoices(societyId),
    getOverdueInvoices(societyId),
  ]);

  const issuedInvoices = invoices.filter(isIssuedInvoiceForBillingKpi);
  const totalTTC = sumInvoiceTotalTTC(issuedInvoices);
  const brouillons = invoices.filter((i) => i.status === "BROUILLON");
  // "À envoyer" : factures billables validées ou en attente, non transmises.
  // Même filtre que la file de masse de l'onglet "À traiter".
  const invoicesToSend = issuedInvoices.filter(
    (i) =>
      i.invoiceType !== "QUITTANCE" &&
      (i.status === "VALIDEE" || i.status === "EN_ATTENTE") &&
      !i.sentAt
  );
  // "Impayés" : aligné sur overdueInvoices (même source que l'onglet Relances).
  // Restant dû = totalTTC − paiements reçus (déduit les paiements partiels).
  const overdueTotal = overdueInvoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.totalTTC -
      invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
    0
  );
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialTab = parseFacturationTab(resolvedSearchParams.tab);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.length} facture{invoices.length !== 1 ? "s" : ""}{" · "}Suivi complet
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportFactures data={invoices.map((inv) => {
            const tenantName = inv.tenant
              ? inv.tenant.entityType === "PERSONNE_MORALE"
                ? (inv.tenant.companyName ?? "—")
                : `${inv.tenant.firstName ?? ""} ${inv.tenant.lastName ?? ""}`.trim() || "—"
              : "—";
            return {
              invoiceNumber: inv.invoiceNumber,
              status: inv.status,
              tenantName,
              building: inv.lease?.lot?.building?.name ?? "—",
              issueDate: new Date(inv.issueDate).toLocaleDateString("fr-FR"),
              dueDate: new Date(inv.dueDate).toLocaleDateString("fr-FR"),
              totalHT: inv.totalHT,
              totalTTC: inv.totalTTC,
            };
          })} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4" />
                Créer
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Création de factures</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/facturation/generer">
                  <Zap className="h-4 w-4" />
                  Générer les appels de loyers
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/facturation/nouvelle">
                  <FilePlus2 className="h-4 w-4" />
                  Facture ponctuelle
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-blue-50/80 to-card dark:from-blue-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatCurrencyAmountFr(totalTTC)}</p>
              <p className="text-xs text-muted-foreground">Total TTC facturé</p>
            </div>
          </div>
        </div>
        <Link
          href="/facturation?tab=relances"
          className="rounded-xl border border-border/60 bg-gradient-to-br from-[var(--color-status-negative-bg)]/80 to-card p-5 shadow-sm transition-colors hover:bg-accent/30"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--color-status-negative-bg)] flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-[var(--color-status-negative)]" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--color-status-negative)]">
                {formatCurrencyAmountFr(overdueTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                Impayés ({overdueInvoices.length}) — restant dû
              </p>
            </div>
          </div>
        </Link>
        <Link
          href="/facturation#a-envoyer"
          className={`rounded-xl border border-border/60 bg-gradient-to-br from-amber-50/80 to-card p-5 shadow-sm transition-colors ${
            invoicesToSend.length > 0 ? "hover:bg-accent/30" : "opacity-60"
          } dark:from-amber-950/20 dark:to-card`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{invoicesToSend.length}</p>
              <p className="text-xs text-muted-foreground">À envoyer (validées)</p>
            </div>
          </div>
        </Link>
        <Link
          href="/facturation?tab=brouillons"
          className="rounded-xl border border-border/60 bg-gradient-to-br from-violet-50/80 to-card p-5 shadow-sm transition-colors hover:bg-accent/30 dark:from-violet-950/20 dark:to-card"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{brouillons.length}</p>
              <p className="text-xs text-muted-foreground">Brouillons à valider</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Tabs: À traiter | Brouillons | Factures | Relances | Quittances */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
        <FacturationTabs
          initialTab={initialTab}
          invoices={invoices}
          brouillons={brouillons}
          overdueInvoices={overdueInvoices}
          societyId={societyId}
          overdueCount={overdueInvoices.length}
        />
      </Suspense>
    </div>
  );
}
