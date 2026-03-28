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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de votre patrimoine immobilier</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus du mois</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{fmt(kpis.currentMonthRevenue)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {kpis.revenueChange >= 0 ? (
                <ArrowUp className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDown className="h-3 w-3 text-red-500" />
              )}
              <span className={kpis.revenueChange >= 0 ? "text-green-600" : "text-red-600"}>
                {kpis.revenueChange >= 0 ? "+" : ""}{kpis.revenueChange}%
              </span>
              <span>vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d&apos;occupation</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{kpis.occupancyRate}%</div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-secondary">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{ width: `${kpis.occupancyRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">lots occupes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impayes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{fmt(kpis.totalOverdueAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">en attente de reglement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {kpis.grossYield !== null ? "Rendement brut" : "Tresorerie"}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {kpis.grossYield !== null
                ? `${kpis.grossYield.toFixed(1)}%`
                : fmt(kpis.availableCash)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {kpis.expiringLeaseCount > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" />
                  {kpis.expiringLeaseCount} bail expirant dans 90j
                </Badge>
              )}
              {kpis.expiringLeaseCount === 0 && (
                <p className="text-xs text-muted-foreground">aucun bail expirant prochainement</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tâches à traiter */}
      <TodayTasks societyId={societyId} />

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenus mensuels</CardTitle>
            <CardDescription>Facturation TTC sur les 12 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Occupation par immeuble</CardTitle>
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
            <CardTitle>Impayes par anciennete</CardTitle>
            <CardDescription>Montants en souffrance par tranche</CardDescription>
          </CardHeader>
          <CardContent>
            <OverdueChart data={overdueByAge} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolution du patrimoine</CardTitle>
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
            <CardTitle>Top 5 locataires</CardTitle>
            <CardDescription>Par volume de facturation total</CardDescription>
          </CardHeader>
          <CardContent>
            <TopTenantsChart data={topTenants} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Echeancier des baux</CardTitle>
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
