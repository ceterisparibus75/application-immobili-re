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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vue d&apos;ensemble de votre patrimoine immobilier</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/60 rounded-t-xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenus du mois</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8">
              <Euro className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{fmt(kpis.currentMonthRevenue)}</div>
            <div className="flex items-center gap-1.5 text-xs mt-1.5">
              {kpis.revenueChange >= 0 ? (
                <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ArrowUp className="h-3 w-3" />
                  +{kpis.revenueChange}%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 font-medium">
                  <ArrowDown className="h-3 w-3" />
                  {kpis.revenueChange}%
                </span>
              )}
              <span className="text-muted-foreground">vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/60 rounded-t-xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux d&apos;occupation</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/8">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{kpis.occupancyRate}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${kpis.occupancyRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">lots occupes</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500/60 rounded-t-xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impayes</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/8">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{fmt(kpis.totalOverdueAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1.5">en attente de reglement</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-violet-500/60 rounded-t-xl" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {kpis.grossYield !== null ? "Rendement brut" : "Tresorerie"}
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/8">
              <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {kpis.grossYield !== null
                ? `${kpis.grossYield.toFixed(1)}%`
                : fmt(kpis.availableCash)}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {kpis.expiringLeaseCount > 0 ? (
                <Badge variant="warning" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" />
                  {kpis.expiringLeaseCount} bail expirant dans 90j
                </Badge>
              ) : (
                <p className="text-xs text-muted-foreground">aucun bail expirant prochainement</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taches a traiter */}
      <TodayTasks societyId={societyId} />

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenus mensuels</CardTitle>
            <CardDescription>Facturation TTC sur les 12 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupation par immeuble</CardTitle>
            <CardDescription>Lots occupes vs vacants</CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={buildingOccupancy} globalRate={kpis.occupancyRate} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impayes par anciennete</CardTitle>
            <CardDescription>Montants en souffrance par tranche</CardDescription>
          </CardHeader>
          <CardContent>
            <OverdueChart data={overdueByAge} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolution du patrimoine</CardTitle>
            <CardDescription>Valeur du patrimoine sur 12 mois</CardDescription>
          </CardHeader>
          <CardContent>
            <PatrimonyChart data={patrimonyPoints} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 locataires</CardTitle>
            <CardDescription>Par volume de facturation total</CardDescription>
          </CardHeader>
          <CardContent>
            <TopTenantsChart data={topTenants} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Echeancier des baux</CardTitle>
            <CardDescription>Baux actifs - progression et date de fin</CardDescription>
          </CardHeader>
          <CardContent>
            <LeaseTimeline data={leaseTimeline} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
