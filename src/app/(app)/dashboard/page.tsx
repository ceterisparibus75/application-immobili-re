import { getAnalyticsData } from "@/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Building2, Euro, TrendingUp, AlertTriangle, Calendar } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OccupancyChart } from "@/components/dashboard/occupancy-chart";
import { OverdueChart } from "@/components/dashboard/overdue-chart";
import { PatrimonyChart } from "@/components/dashboard/patrimony-chart";
import { TopTenantsChart } from "@/components/dashboard/top-tenants-chart";
import { LeaseTimeline } from "@/components/dashboard/lease-timeline";
import { TodayTasks } from "@/components/dashboard/today-tasks";

export const metadata = { title: "Tableau de bord" };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default async function DashboardPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/login");

  const data = await getAnalyticsData(societyId);
  if (!data) redirect("/login");

  const { kpis, monthlyRevenue, buildingOccupancy, overdueByAge, patrimonyPoints, topTenants, leaseTimeline } = data;

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de votre patrimoine immobilier</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-xs text-muted-foreground mt-1.5">lots occupes</p>
        </div>

        {/* Impayes */}
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-amber-50/80 to-card dark:from-amber-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Impayes</span>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{fmt(kpis.totalOverdueAmount)}</p>
          <p className="text-xs text-muted-foreground mt-2">en attente de reglement</p>
        </div>

        {/* Rendement / Tresorerie */}
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-violet-50/80 to-card dark:from-violet-950/20 dark:to-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {kpis.grossYield !== null ? "Rendement brut" : "Tresorerie"}
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

      {/* Taches */}
      <TodayTasks societyId={societyId} />

      {/* Charts Row 1 */}
      <div className="grid gap-5 lg:grid-cols-2">
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
            <CardDescription>Lots occupes vs vacants</CardDescription>
          </CardHeader>
          <CardContent><OccupancyChart data={buildingOccupancy} globalRate={kpis.occupancyRate} /></CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impayes par anciennete</CardTitle>
            <CardDescription>Montants en souffrance par tranche</CardDescription>
          </CardHeader>
          <CardContent><OverdueChart data={overdueByAge} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolution du patrimoine</CardTitle>
            <CardDescription>Valeur du patrimoine sur 12 mois</CardDescription>
          </CardHeader>
          <CardContent><PatrimonyChart data={patrimonyPoints} /></CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 locataires</CardTitle>
            <CardDescription>Par volume de facturation total</CardDescription>
          </CardHeader>
          <CardContent><TopTenantsChart data={topTenants} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Echeancier des baux</CardTitle>
            <CardDescription>Baux actifs - progression et date de fin</CardDescription>
          </CardHeader>
          <CardContent><LeaseTimeline data={leaseTimeline} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
