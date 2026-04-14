import { getAnalyticsData } from "@/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OccupancyChart } from "@/components/dashboard/occupancy-chart";
import { OverdueChart } from "@/components/dashboard/overdue-chart";
import { PatrimonyChart } from "@/components/dashboard/patrimony-chart";
import { RiskConcentrationChart } from "@/components/dashboard/risk-concentration-chart";
import { LeaseTimeline } from "@/components/dashboard/lease-timeline";
import { TodayTasks } from "@/components/dashboard/today-tasks";
import { EcheancesPanel } from "@/components/dashboard/echeances-panel";
import { ExportPdfButton } from "@/components/dashboard/export-pdf-button";
import { KpiCards } from "./_components/kpi-cards";
import { ActionsBar } from "./_components/actions-bar";
import { TrackingPanel } from "./_components/tracking-panel";

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

  const { kpis, monthlyRevenue, buildingOccupancy, overdueByAge, patrimonyPoints, riskConcentration, leaseTimeline, lenderSummaries } = data;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de votre patrimoine immobilier</p>
        </div>
        <ExportPdfButton />
      </div>

      {/* ── KPI Cards ── */}
      <KpiCards kpis={kpis} />

      {/* ── Actions requises ── */}
      {(kpis.pendingRevisionCount > 0 || kpis.invoicesToIssueCount > 0 || kpis.unpaidInvoiceCount > 0) && (
        <ActionsBar
          pendingRevisionCount={kpis.pendingRevisionCount}
          invoicesToIssueCount={kpis.invoicesToIssueCount}
          unpaidInvoiceCount={kpis.unpaidInvoiceCount}
        />
      )}

      {/* ── Endettement ── */}
      {kpis.activeLoanCount > 0 && lenderSummaries.length > 0 && (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-blue)]/10">
                <Landmark className="h-4 w-4 text-[var(--color-brand-blue)]" />
              </div>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Endettement</CardTitle>
            </div>
            <CardDescription>Capital restant dû et mensualités</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-3 gap-px bg-gray-100">
              <div className="bg-white p-4">
                <p className="text-xs text-muted-foreground mb-1">Capital restant dû</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-status-negative)]">{fmt(kpis.totalDebt)}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs text-muted-foreground mb-1">Mensualité totale</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(kpis.monthlyLoanPayment)}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs text-muted-foreground mb-1">LTV</p>
                <p className={"text-lg font-semibold tabular-nums " + (kpis.ltv !== null && kpis.ltv > 80 ? "text-[var(--color-status-negative)]" : kpis.ltv !== null && kpis.ltv > 60 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]")}>
                  {kpis.ltv !== null ? `${kpis.ltv}%` : "—"}
                </p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-100">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Établissement</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Emprunts</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Restant dû</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Mensualité</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">Remboursé</th>
                </tr>
              </thead>
              <tbody>
                {lenderSummaries.map((ls) => (
                  <tr key={ls.lender} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 font-medium text-[var(--color-brand-deep)]">{ls.lender}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{ls.loanCount}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[var(--color-status-negative)] font-semibold">{fmt(ls.remainingBalance)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{fmt(ls.monthlyPayment)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-gradient-soft" style={{ width: ls.pctRepaid + "%" }} />
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
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Revenus mensuels</CardTitle>
              <CardDescription>Facturation TTC sur les 12 derniers mois</CardDescription>
            </CardHeader>
            <CardContent><RevenueChart data={monthlyRevenue} /></CardContent>
          </Card>
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Occupation par immeuble</CardTitle>
              <CardDescription>Lots occupés vs vacants</CardDescription>
            </CardHeader>
            <CardContent><OccupancyChart data={buildingOccupancy} globalRate={kpis.occupancyRate} /></CardContent>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Impayés par ancienneté</CardTitle>
                <CardDescription>Montants en souffrance</CardDescription>
              </CardHeader>
              <CardContent><OverdueChart data={overdueByAge} /></CardContent>
            </Card>
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Évolution patrimoine</CardTitle>
                <CardDescription>Valeur cumulée</CardDescription>
              </CardHeader>
              <CardContent><PatrimonyChart data={patrimonyPoints} /></CardContent>
            </Card>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Division du risque</CardTitle>
                <CardDescription>Concentration des revenus locatifs</CardDescription>
              </CardHeader>
              <CardContent><RiskConcentrationChart data={riskConcentration} /></CardContent>
            </Card>
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Échéancier des baux</CardTitle>
                <CardDescription>Progression et fin</CardDescription>
              </CardHeader>
              <CardContent><LeaseTimeline data={leaseTimeline} /></CardContent>
            </Card>
          </div>
        </div>

        {/* Colonne droite : Panneau de suivi (1/3) */}
        <div className="space-y-5">
          <TodayTasks societyId={societyId} />

          <EcheancesPanel societyId={societyId} />

          <TrackingPanel kpis={kpis} />
        </div>
      </div>
    </div>
  );
}
