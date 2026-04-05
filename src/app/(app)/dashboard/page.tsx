import { getAnalyticsData } from "@/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown, ArrowUp, Building2, TrendingUp, AlertTriangle, Calendar,
  Banknote,
} from "lucide-react";
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
import { OnboardingChecklist } from "@/components/onboarding-checklist";

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

  const { kpis, monthlyRevenue, buildingOccupancy, overdueByAge, patrimonyPoints, topTenants, leaseTimeline, lenderSummaries } = data;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de votre patrimoine immobilier</p>
      </div>

      {/* ── Onboarding Checklist ── */}
      <OnboardingChecklist />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl border bg-border/50 overflow-hidden">
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Revenus du mois</p>
          <p className="text-xl font-bold tabular-nums">{fmt(kpis.currentMonthRevenue)}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {kpis.revenueChange >= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                <ArrowUp className="h-3 w-3" />+{kpis.revenueChange}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive">
                <ArrowDown className="h-3 w-3" />{kpis.revenueChange}%
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">vs mois dernier</span>
          </div>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Occupation</p>
          <p className="text-xl font-bold tabular-nums">{kpis.occupancyRate}%</p>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${kpis.occupancyRate}%` }} />
          </div>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Impayés</p>
          <p className={"text-xl font-bold tabular-nums " + (kpis.totalOverdueAmount > 0 ? "text-destructive" : "")}>{fmt(kpis.totalOverdueAmount)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">en attente de règlement</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {kpis.grossYield !== null ? "Rendement brut" : "Trésorerie"}
          </p>
          <p className="text-xl font-bold tabular-nums">
            {kpis.grossYield !== null ? `${kpis.grossYield.toFixed(1)}%` : fmt(kpis.availableCash)}
          </p>
          {kpis.expiringLeaseCount > 0 ? (
            <Badge variant="warning" className="text-[10px] gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              {kpis.expiringLeaseCount} bail expirant sous 90j
            </Badge>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5">aucun bail expirant</p>
          )}
        </div>
      </div>

      {/* ── Endettement ── */}
      {kpis.activeLoanCount > 0 && lenderSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Endettement</CardTitle>
            </div>
            <CardDescription>Capital restant dû et mensualités</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-3 gap-px bg-border/50">
              <div className="bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Capital restant dû</p>
                <p className="text-lg font-bold tabular-nums text-destructive">{fmt(kpis.totalDebt)}</p>
              </div>
              <div className="bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Mensualité totale</p>
                <p className="text-lg font-bold tabular-nums">{fmt(kpis.monthlyLoanPayment)}</p>
              </div>
              <div className="bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">LTV</p>
                <p className={"text-lg font-bold tabular-nums " + (kpis.ltv !== null && kpis.ltv > 80 ? "text-destructive" : kpis.ltv !== null && kpis.ltv > 60 ? "text-amber-600" : "text-emerald-600")}>
                  {kpis.ltv !== null ? `${kpis.ltv}%` : "—"}
                </p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Établissement</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Emprunts</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Restant dû</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Mensualité</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Remboursé</th>
                </tr>
              </thead>
              <tbody>
                {lenderSummaries.map((ls) => (
                  <tr key={ls.lender} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{ls.lender}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{ls.loanCount}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-destructive font-semibold">{fmt(ls.remainingBalance)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{fmt(ls.monthlyPayment)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: ls.pctRepaid + "%" }} />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground w-8 text-right">{ls.pctRepaid}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
                  {kpis.ltv !== null && (
                    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                      <span className="text-sm">LTV (Loan-to-Value)</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${kpis.ltv > 80 ? "text-destructive" : kpis.ltv > 60 ? "text-amber-600" : "text-emerald-600"}`}>{kpis.ltv}%</span>
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kpis.ltv > 80 ? "bg-red-500" : kpis.ltv > 60 ? "bg-amber-500" : "bg-emerald-500"}`} />
                      </div>
                    </div>
                  )}
                  {kpis.patrimonyValue > 0 && (
                    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                      <span className="text-sm">Valeur patrimoine</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">{fmt(kpis.patrimonyValue)}</span>
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-violet-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
