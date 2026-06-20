import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  BookOpen,
  Landmark,
  PenLine,
  Plus,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { getFinancesGuidance } from "@/lib/module-guidance";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Finances" };

export default async function FinancesPage() {
  const h = await headers();
  const societyId = h.get("x-society-id");
  const session = await auth();

  if (!societyId) redirect("/societes");
  if (!session?.user?.id) redirect("/login");

  await requireSocietyAccess(session.user.id, societyId);

  const [bankAccounts, activeLoans, draftEntries, unpaidInvoices, balanceAggregate] = await Promise.all([
    prisma.bankAccount.count({ where: { societyId, isActive: true } }),
    prisma.loan.count({ where: { societyId, status: "EN_COURS" } }),
    prisma.journalEntry.count({ where: { societyId, status: "BROUILLON" } }),
    prisma.invoice.count({ where: { societyId, status: { in: ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE"] }, invoiceType: { notIn: ["AVOIR", "QUITTANCE"] } } }),
    prisma.bankAccount.aggregate({
      where: { societyId, isActive: true },
      _sum: { currentBalance: true },
    }),
  ]);

  const bankBalance = balanceAggregate._sum.currentBalance ?? 0;

  const metrics = [
    { label: "Solde bancaire", value: formatCurrency(bankBalance), icon: Landmark },
    { label: "Comptes actifs", value: bankAccounts.toString(), icon: Banknote },
    { label: "Emprunts en cours", value: activeLoans.toString(), icon: Wallet },
    { label: "Écritures brouillon", value: draftEntries.toString(), icon: BookOpen },
  ];

  const workflows = [
    {
      title: "Encaisser et rapprocher",
      description: "Contrôlez les comptes bancaires, synchronisez les mouvements et préparez le rapprochement.",
      href: "/banque",
      action: "Ouvrir la banque",
      icon: Landmark,
    },
    {
      title: "Tenir la comptabilité",
      description: "Saisissez les écritures, consultez le grand livre et exportez les éléments comptables.",
      href: "/comptabilite",
      action: "Ouvrir la comptabilité",
      icon: BookOpen,
    },
    {
      title: "Piloter la trésorerie",
      description: "Suivez cash-flow, emprunts, impayés et rapports pour décider plus vite.",
      href: "/cashflow",
      action: "Voir le cash-flow",
      icon: BarChart3,
    },
  ];

  const guidanceSteps = getFinancesGuidance({
    bankAccounts,
    draftEntries,
    unpaidInvoices,
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finances</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {bankAccounts} compte{bankAccounts !== 1 ? "s" : ""} actif{bankAccounts !== 1 ? "s" : ""}{" · "}
            {unpaidInvoices} facture{unpaidInvoices !== 1 ? "s" : ""} à suivre
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/banque/nouveau-compte">
              <Plus className="h-4 w-4" />
              Ajouter un compte
            </Link>
          </Button>
          <Button asChild>
            <Link href="/comptabilite/nouvelle-ecriture">
              <PenLine className="h-4 w-4" />
              Nouvelle écriture
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <metric.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {guidanceSteps.length > 0 && (
        <section className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Prochaines actions</h2>
              <p className="text-sm text-muted-foreground">
                Les raccourcis les plus utiles selon l'état actuel de la trésorerie.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {guidanceSteps.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="group rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{step.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {step.action}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <Card key={workflow.title}>
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <workflow.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-semibold">{workflow.title}</h2>
                <p className="text-sm text-muted-foreground">{workflow.description}</p>
              </div>
              <Link href={workflow.href} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                {workflow.action}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {(draftEntries > 0 || unpaidInvoices > 0) && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">À traiter en priorité</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {draftEntries > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/comptabilite">Valider les écritures brouillon</Link>
              </Button>
            )}
            {unpaidInvoices > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href="/facturation?tab=retard">Voir les factures à suivre</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

