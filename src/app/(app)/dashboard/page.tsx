import { getAnalyticsData } from "@/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown, ArrowUp, Building2, Euro, TrendingUp, AlertTriangle, Calendar,
  FileText, Users, Wallet, Landmark, Receipt, Shield, Layers,
  Banknote, ClipboardList, Contact, BookOpen, FolderOpen, Crown,
} from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OccupancyChart } from "@/components/dashboard/occupancy-chart";
import { OverdueChart } from "@/components/dashboard/overdue-chart";
import { PatrimonyChart } from "@/components/dashboard/patrimony-chart";
import { TopTenantsChart } from "@/components/dashboard/top-tenants-chart";
import { LeaseTimeline } from "@/components/dashboard/lease-timeline";
import { TodayTasks } from "@/components/dashboard/today-tasks";
import { DashboardNotifications } from "@/components/dashboard/dashboard-notifications";

export const metadata = { title: "Tableau de bord" };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const MODULES = [
  { label: "Propriétaire", href: "/proprietaire", icon: Crown },
  { label: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
  { label: "Lots", href: "/patrimoine/lots", icon: Layers },
  { label: "Baux", href: "/baux", icon: FileText },
  { label: "Locataires", href: "/locataires", icon: Users },
  { label: "Facturation", href: "/facturation", icon: Receipt },
  { label: "Charges", href: "/charges", icon: Wallet },
  { label: "Banque", href: "/banque", icon: Landmark },
  { label: "Emprunts", href: "/emprunts", icon: Banknote },
  { label: "Comptabilité", href: "/comptabilite", icon: BookOpen },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Contacts", href: "/contacts", icon: Contact },
  { label: "Indices", href: "/indices", icon: TrendingUp },
  { label: "RGPD", href: "/rgpd", icon: Shield },
] as const;

export default async function DashboardPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/login");

  const data = await getAnalyticsData(societyId);
  if (!data) redirect("/login");

  const { kpis, monthlyRevenue, buildingOccupancy, overdueByAge, patrimonyPoints, topTenants, leaseTimeline } = data;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de votre patrimoine immobilier</p>
      </div>

      {/* ── Tuiles d'acces rapide ── */}
      <section>
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-2.5">Accès rapide</h2>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1.5">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group flex flex-col items-center gap-1 rounded-lg bg-gradient-to-b from-primary to-primary/85 px-2 py-2.5 text-primary-foreground shadow-[0_1px_3px_0_rgb(0_0_0/0.2),inset_0_1px_0_0_rgb(255_255_255/0.1)] hover:shadow-[0_2px_8px_0_rgb(0_0_0/0.25)] hover:brightness-110 active:scale-[0.96] transition-all"
              >
                <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] font-medium leading-tight text-center opacity-80 group-hover:opacity-100 transition-opacity">{mod.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenus */}
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-blue-50/80 to-card dark:from-blue-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenus du mois</span>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Euro className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums">{fmt(kpis.currentMonthRevenue)}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {kpis.revenueChange >= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                <ArrowUp className="h-3 w-3" />+{kpis.revenueChange}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-md">
                <ArrowDown className="h-3 w-3" />{kpis.revenueChange}%
              </span>
            )}
            <span className="text-xs text-muted-foreground">vs mois dernier</span>
          </div>
        </div>

        {/* Occupation */}
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-emerald-50/80 to-card dark:from-emerald-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Taux d&apos;occupation</span>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Building2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums">{kpis.occupancyRate}%</p>
          <div className="mt-3 h-2 w-full rounded-full bg-emerald-100 dark:bg-emerald-950/40">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${kpis.occupancyRate}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">lots occupés</p>
        </div>

        {/* Impayes */}
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-amber-50/80 to-card dark:from-amber-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Impayés</span>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{fmt(kpis.totalOverdueAmount)}</p>
          <p className="text-xs text-muted-foreground mt-2">en attente de règlement</p>
        </div>

        {/* Rendement / Tresorerie */}
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-violet-50/80 to-card dark:from-violet-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {kpis.grossYield !== null ? "Rendement brut" : "Trésorerie"}
            </span>
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {kpis.grossYield !== null ? `${kpis.grossYield.toFixed(1)}%` : fmt(kpis.availableCash)}
          </p>
          <div className="mt-2">
            {kpis.expiringLeaseCount > 0 ? (
              <Badge variant="warning" className="text-[10px] gap-1">
                <Calendar className="h-3 w-3" />
                {kpis.expiringLeaseCount} bail expirant dans 90j
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">aucun bail expirant prochainement</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenu principal : Graphiques + Panneau de suivi ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne gauche : Graphiques (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenus mensuels</CardTitle>
              <CardDescription>Facturation TTC sur les 12 derniers mois</CardDescription>
            </CardHeader>
            <CardContent><RevenueChart data={monthlyRevenue} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Occupation par immeuble</CardTitle>
              <CardDescription>Lots occupés vs vacants</CardDescription>
            </CardHeader>
            <CardContent><OccupancyChart data={buildingOccupancy} globalRate={kpis.occupancyRate} /></CardContent>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Impayés par ancienneté</CardTitle>
                <CardDescription>Montants en souffrance</CardDescription>
              </CardHeader>
              <CardContent><OverdueChart data={overdueByAge} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Évolution patrimoine</CardTitle>
                <CardDescription>Valeur cumulée</CardDescription>
              </CardHeader>
              <CardContent><PatrimonyChart data={patrimonyPoints} /></CardContent>
            </Card>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 locataires</CardTitle>
                <CardDescription>Volume de facturation</CardDescription>
              </CardHeader>
              <CardContent><TopTenantsChart data={topTenants} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Échéancier des baux</CardTitle>
                <CardDescription>Progression et fin</CardDescription>
              </CardHeader>
              <CardContent><LeaseTimeline data={leaseTimeline} /></CardContent>
            </Card>
          </div>
        </div>

        {/* Colonne droite : Panneau de suivi (1/3) */}
        <div className="space-y-5">
          <TodayTasks societyId={societyId} />
          <DashboardNotifications />

          {/* Panneau de suivi style ORISHA */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Suivi</CardTitle>
              <CardDescription>Points d&apos;attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Facturation */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Facturation</h4>
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                  <span className="text-sm">Impayés</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{fmt(kpis.totalOverdueAmount)}</span>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.totalOverdueAmount > 0 ? "bg-red-500 shadow-[0_0_6px_rgb(239_68_68/0.5)]" : "bg-emerald-500"}`} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                  <span className="text-sm">Loyers mensuels HT</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{fmt(kpis.monthlyRentHT)}</span>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-blue-500" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                  <span className="text-sm">Charges récup.</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{fmt(kpis.recoverableCharges)}</span>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-blue-500" />
                  </div>
                </div>
              </div>

              {/* Baux */}
              <div className="border-t pt-4 space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Baux</h4>
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                  <span className="text-sm">Expirant sous 90j</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{kpis.expiringLeaseCount}</span>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.expiringLeaseCount > 0 ? "bg-amber-500 shadow-[0_0_6px_rgb(245_158_11/0.5)]" : "bg-emerald-500"}`} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                  <span className="text-sm">Taux occupation</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{kpis.occupancyRate}%</span>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.occupancyRate >= 80 ? "bg-emerald-500" : kpis.occupancyRate >= 50 ? "bg-amber-500" : "bg-red-500"}`} />
                  </div>
                </div>
              </div>

              {/* Tresorerie */}
              <div className="border-t pt-4 space-y-2.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Trésorerie</h4>
                <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                  <span className="text-sm">Solde disponible</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{fmt(kpis.availableCash)}</span>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.availableCash >= 0 ? "bg-emerald-500" : "bg-red-500 shadow-[0_0_6px_rgb(239_68_68/0.5)]"}`} />
                  </div>
                </div>
                {kpis.grossYield !== null && (
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                    <span className="text-sm">Rendement brut</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{kpis.grossYield.toFixed(1)}%</span>
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.grossYield >= 5 ? "bg-emerald-500" : kpis.grossYield >= 3 ? "bg-amber-500" : "bg-red-500"}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Dette SCI */}
              {kpis.activeLoanCount > 0 && (
                <div className="border-t pt-4 space-y-2.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Dette SCI</h4>
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                    <span className="text-sm">Capital restant dû</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{fmt(kpis.totalDebt)}</span>
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.totalDebt > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                    <span className="text-sm">Mensualité totale</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{fmt(kpis.monthlyLoanPayment)}</span>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-blue-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                    <span className="text-sm">Emprunts actifs</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{kpis.activeLoanCount}</span>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-blue-500" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
