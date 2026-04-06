import { getAnalyticsData } from "@/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown, ArrowUp, Building2, TrendingUp, AlertTriangle, Calendar,
  Banknote, Wallet, Home, Users, FileText, Landmark, Wrench, ShieldCheck,
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
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ExportPdfButton } from "@/components/dashboard/export-pdf-button";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground mt-1">Vue d&apos;ensemble de votre patrimoine immobilier</p>
        </div>
        <ExportPdfButton />
      </div>

      {/* ── Onboarding Checklist ── */}
      <OnboardingChecklist />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Revenus du mois</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(kpis.currentMonthRevenue)}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {kpis.revenueChange >= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)] px-1.5 py-0.5 rounded-full">
                <ArrowUp className="h-3 w-3" />+{kpis.revenueChange}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)] px-1.5 py-0.5 rounded-full">
                <ArrowDown className="h-3 w-3" />{kpis.revenueChange}%
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">vs mois dernier</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Occupation</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.occupancyRate}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-brand-gradient-soft transition-all" style={{ width: `${kpis.occupancyRate}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Impayés</p>
          <p className={"text-2xl font-semibold tabular-nums " + (kpis.totalOverdueAmount > 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]")}>{fmt(kpis.totalOverdueAmount)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">en attente de règlement</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {kpis.grossYield !== null ? "Rendement brut" : "Trésorerie"}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
            {kpis.grossYield !== null ? `${kpis.grossYield.toFixed(1)}%` : fmt(kpis.availableCash)}
          </p>
          {kpis.expiringLeaseCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)] px-1.5 py-0.5 rounded-full mt-1.5">
              <Calendar className="h-3 w-3" />
              {kpis.expiringLeaseCount} bail expirant sous 90j
            </span>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">aucun bail expirant</p>
          )}
        </div>
      </div>

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
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Top 5 locataires</CardTitle>
                <CardDescription>Volume de facturation</CardDescription>
              </CardHeader>
              <CardContent><TopTenantsChart data={topTenants} /></CardContent>
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

          {/* Panneau de suivi complet */}
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Suivi</CardTitle>
              <CardDescription>Vue complète de votre activité</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Patrimoine */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Home className="h-3 w-3" /> Patrimoine
                </h4>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Immeubles</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.totalBuildings}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Lots (occupés / vacants)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.occupiedLots} / {kpis.vacantLots}</span>
                    <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.vacantLots === 0 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : kpis.vacantLots <= 2 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                      {kpis.vacantLots === 0 ? "Complet" : `${kpis.vacantLots} vacant${kpis.vacantLots > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Taux d&apos;occupation</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.occupancyRate}%</span>
                    <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.occupancyRate >= 80 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : kpis.occupancyRate >= 50 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                      {kpis.occupancyRate >= 80 ? "Bon" : kpis.occupancyRate >= 50 ? "Moyen" : "Faible"}
                    </span>
                  </div>
                </div>
                {kpis.patrimonyValue > 0 && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Valeur patrimoine</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(kpis.patrimonyValue)}</span>
                  </div>
                )}
                {kpis.grossYield !== null && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Rendement brut</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.grossYield.toFixed(1)}%</span>
                      <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.grossYield >= 5 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : kpis.grossYield >= 3 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                        {kpis.grossYield >= 5 ? "Bon" : kpis.grossYield >= 3 ? "Moyen" : "Faible"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Locataires & Baux */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Locataires &amp; Baux
                </h4>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Locataires actifs</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.totalTenants}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Baux en cours</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.activeLeaseCount}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Baux expirant sous 90j</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.expiringLeaseCount}</span>
                    {kpis.expiringLeaseCount > 0 && (
                      <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">Attention</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Facturation */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Facturation
                </h4>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Loyers mensuels HT</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(kpis.monthlyRentHT)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Factures impayées</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.unpaidInvoiceCount}</span>
                    {kpis.unpaidInvoiceCount > 0 && (
                      <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]">{kpis.unpaidInvoiceCount}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Montant impayé</span>
                  <span className={`text-sm font-semibold tabular-nums ${kpis.totalOverdueAmount > 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]"}`}>{fmt(kpis.totalOverdueAmount)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Charges récup.</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(kpis.recoverableCharges)}</span>
                </div>
              </div>

              {/* Trésorerie */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Wallet className="h-3 w-3" /> Trésorerie
                </h4>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Solde disponible</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold tabular-nums ${kpis.availableCash >= 0 ? "text-[var(--color-brand-deep)]" : "text-[var(--color-status-negative)]"}`}>{fmt(kpis.availableCash)}</span>
                    <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.availableCash >= 0 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                      {kpis.availableCash >= 0 ? "OK" : "Négatif"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technique */}
              {(kpis.expiringDiagnosticCount > 0 || kpis.openMaintenanceCount > 0) && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" /> Technique
                  </h4>
                  {kpis.expiringDiagnosticCount > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <span className="text-sm text-[var(--color-brand-deep)]">Diagnostics expirant 90j</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.expiringDiagnosticCount}</span>
                        <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">Attention</span>
                      </div>
                    </div>
                  )}
                  {kpis.openMaintenanceCount > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <span className="text-sm text-[var(--color-brand-deep)]">Maintenances en cours</span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.openMaintenanceCount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dette */}
              {kpis.activeLoanCount > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <Landmark className="h-3 w-3" /> Endettement
                  </h4>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Capital restant dû</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-status-negative)]">{fmt(kpis.totalDebt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Mensualité totale</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(kpis.monthlyLoanPayment)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Emprunts actifs</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{kpis.activeLoanCount}</span>
                  </div>
                  {kpis.ltv !== null && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <span className="text-sm text-[var(--color-brand-deep)]">LTV</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${kpis.ltv > 80 ? "text-[var(--color-status-negative)]" : kpis.ltv > 60 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>{kpis.ltv}%</span>
                        <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.ltv > 80 ? "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]" : kpis.ltv > 60 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"}`}>
                          {kpis.ltv > 80 ? "Élevé" : kpis.ltv > 60 ? "Moyen" : "Sain"}
                        </span>
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
