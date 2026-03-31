import { Suspense } from "react";
import { getInvoices } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { Euro, FileText, Plus, Zap, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireSocietyAccess } from "@/lib/permissions";
import { FacturationTabs } from "./_components/facturation-tabs";

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

export default async function FacturationPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const [invoices, overdueInvoices, reminders] = await Promise.all([
    getInvoices(societyId),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {invoices.length} facture{invoices.length !== 1 ? "s" : ""} &middot; Suivi complet
          </p>
        </div>
        <div className="flex gap-2">
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
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-amber-50/80 to-card dark:from-amber-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{totalImpaye.toLocaleString("fr-FR")} &euro;</p>
              <p className="text-xs text-muted-foreground">Impayes ({enAttente.length + enRetard.length})</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-red-50/80 to-card dark:from-red-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{overdueInvoices.length}</p>
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
