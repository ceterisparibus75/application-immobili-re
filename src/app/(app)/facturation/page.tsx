import { Suspense } from "react";
import { getFilteredInvoices } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Euro, FileText, Plus, Zap, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { FacturationTabs } from "./_components/facturation-tabs";
import { GestionLocativeNav } from "@/components/layout/gestion-locative-nav";
import { FacturationFilters } from "./_components/facturation-filters";

export const metadata = { title: "Facturation" };

async function getOverdueInvoices(societyId: string) {
  return prisma.invoice.findMany({
    where: {
      societyId,
      status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE"] },
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

async function getRecentReminders(societyId: string) {
  return prisma.reminder.findMany({
    where: { lease: { societyId } },
    select: {
      id: true,
      level: true,
      subject: true,
      totalAmount: true,
      sentAt: true,
      isSent: true,
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
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export default async function FacturationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const params = await searchParams;
  const statusFilter = typeof params.filter_status === "string" ? params.filter_status : undefined;
  const typeFilter = typeof params.filter_invoiceType === "string" ? params.filter_invoiceType : undefined;
  const periodFrom = typeof params.filter_period_from === "string" ? params.filter_period_from : undefined;
  const periodTo = typeof params.filter_period_to === "string" ? params.filter_period_to : undefined;
  const amountMin = typeof params.filter_amount_min === "string" ? params.filter_amount_min : undefined;
  const amountMax = typeof params.filter_amount_max === "string" ? params.filter_amount_max : undefined;

  const [invoices, overdueInvoices, reminders] = await Promise.all([
    getFilteredInvoices(societyId, {
      status: statusFilter,
      invoiceType: typeFilter,
      periodFrom,
      periodTo,
      amountMin,
      amountMax,
    }),
    getOverdueInvoices(societyId),
    getRecentReminders(societyId),
  ]);

  const enAttente = invoices.filter((i) => i.status === "EN_ATTENTE");
  const enRetard = invoices.filter((i) => i.status === "EN_RETARD");
  const totalTTC = invoices
    .filter((i) => i.invoiceType !== "AVOIR")
    .reduce((s, i) => s + i.totalTTC, 0);
  const totalImpaye = [...enAttente, ...enRetard].reduce((s, i) => s + i.totalTTC, 0);
  const brouillons = invoices.filter((i) => i.status === "BROUILLON");
  const totalOverdue = overdueInvoices.reduce((s, inv) => {
    const paid = inv.payments.reduce((ps, p) => ps + p.amount, 0);
    return s + inv.totalTTC - paid;
  }, 0);
  const remindersCount = reminders.filter((r) => r.isSent).length;

  return (
    <div className="space-y-6 max-w-7xl">
      <GestionLocativeNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.length} facture{invoices.length !== 1 ? "s" : ""} &middot; Suivi complet
          </p>
        </div>
        <div className="flex gap-2">
          <FacturationFilters />
          <Link href="/facturation/generer">
            <Button variant="outline"><Zap className="h-4 w-4" />Generer les appels</Button>
          </Link>
          <Link href="/facturation/nouvelle">
            <Button><Plus className="h-4 w-4" />Nouvelle facture</Button>
          </Link>
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
              <p className="text-2xl font-bold tabular-nums">{totalTTC.toLocaleString("fr-FR")} &euro;</p>
              <p className="text-xs text-muted-foreground">Total TTC</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-[var(--color-status-caution-bg)]/80 to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--color-status-caution-bg)] flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-[var(--color-status-caution)]" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--color-status-caution)]">{totalImpaye.toLocaleString("fr-FR")} &euro;</p>
              <p className="text-xs text-muted-foreground">Impayes ({enAttente.length + enRetard.length})</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-[var(--color-status-negative-bg)]/80 to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--color-status-negative-bg)] flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-[var(--color-status-negative)]" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--color-status-negative)]">{overdueInvoices.length}</p>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-violet-50/80 to-card dark:from-violet-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{remindersCount}</p>
              <p className="text-xs text-muted-foreground">Relances envoyees</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Factures | En retard | Relances */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
        <FacturationTabs
          invoices={invoices}
          brouillons={brouillons}
          overdueInvoices={overdueInvoices}
          reminders={reminders}
          societyId={societyId}
          overdueCount={overdueInvoices.length}
          remindersCount={remindersCount}
        />
      </Suspense>
    </div>
  );
}
