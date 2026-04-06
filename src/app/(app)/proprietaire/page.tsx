import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOwnerAnalytics, getClaimableSocieties, getOwnerProfile } from "@/actions/owner";
import { getProprietaires, migrateOwnerToProprietaire } from "@/actions/proprietaire";
import { getSocieties } from "@/actions/society";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, Layers, Landmark, Banknote,
  TrendingUp, Calendar, Wallet, Plus, Clock,
  BarChart3, PieChart,
} from "lucide-react";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";
import { ClaimSocietyDialog } from "./_components/claim-society-dialog";
import { OwnerProfileForm } from "./_components/owner-profile-form";
import { ProprietaireTabs } from "./_components/proprietaire-tabs";
import { ProprietaireSelector } from "./_components/proprietaire-selector";

export const metadata = { title: "Vue proprietaire" };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(occupied: number, total: number) {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100);
}

export default async function ProprietaireDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Migration automatique : si l'utilisateur n'a pas de proprietaire, en créer un
  const propList = await getProprietaires();
  if (propList.success && (!propList.data || propList.data.length === 0)) {
    await migrateOwnerToProprietaire();
  }

  const params = await searchParams;
  const selectedPid = params.pid;

  const [propResult, claimableResult, profileResult, societies] = await Promise.all([
    getProprietaires(),
    getClaimableSocieties(),
    getOwnerProfile(),
    getSocieties(),
  ]);

  const proprietaires = propResult.success ? (propResult.data ?? []) : [];
  const activePid = selectedPid && proprietaires.find((p) => p.id === selectedPid)
    ? selectedPid
    : proprietaires[0]?.id ?? null;

  // Charger les analytics pour le proprietaire sélectionné
  const result = await getOwnerAnalytics(activePid ?? undefined);
  if (!result.success || !result.data) redirect("/login");

  const data = result.data;
  const claimable = claimableResult.success ? (claimableResult.data ?? []) : [];
  const profile = profileResult.success ? profileResult.data : null;

  if (data.totalSocieties === 0 && claimable.length === 0 && proprietaires.length === 0) {
    redirect("/proprietaire/setup");
  }

  const dashboardContent = (
    <>
      {/* KPI principaux — 4 cartes identiques, hauteur fixe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-brand flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
            </div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Revenus mensuels</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalMonthRevenue)}</p>
            <p className="text-[10px] text-[#94A3B8] mt-1">Loyers HT : {fmt(data.totalMonthlyRentHT)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
              <Landmark className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
            </div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Trésorerie</p>
          </div>
          <div>
            <p className={`text-2xl font-bold tabular-nums ${data.totalCash < 0 ? "text-red-500" : "text-[var(--color-brand-deep)]"}`}>{fmt(data.totalCash)}</p>
            <p className="text-[10px] text-[#94A3B8] mt-1">{data.totalSocieties} société{data.totalSocieties > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 shrink-0">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Impayés</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalOverdue)}</p>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              {data.totalOverdue > 0 && <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 mr-1">en attente</span>}
              {data.totalOverdue === 0 && "aucun impayé"}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)] shrink-0">
              <BarChart3 className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
            </div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">
              {data.grossYield !== null ? "Rendement brut" : "Occupation"}
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-brand-deep)]">
              {data.grossYield !== null ? `${data.grossYield}%` : `${data.occupancyRate}%`}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              {data.totalBuildings} immeuble{data.totalBuildings > 1 ? "s" : ""} · {data.totalLots} lots · {data.totalActiveLeases} baux
            </p>
          </div>
        </div>
      </div>

      {/* Contenu principal : 2/3 + 1/3 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-6">

          {/* Endettement consolidé — KPIs compacts + liste établissements */}
          {data.totalDebt > 0 && (
            <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
              <CardHeader className="pb-3 px-6 pt-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
                    <Banknote className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Endettement consolidé</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-4">
                {/* Totaux compacts */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-[#F9FAFB] p-3">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide mb-1">Capital restant dû</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalDebt)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F9FAFB] p-3">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide mb-1">Mensualité totale</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalMonthlyLoanPayment)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F9FAFB] p-3">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide mb-1">LTV consolidé</p>
                    <p className={`text-lg font-bold tabular-nums ${data.consolidatedLTV !== null && data.consolidatedLTV > 80 ? "text-red-500" : data.consolidatedLTV !== null && data.consolidatedLTV > 60 ? "text-amber-500" : "text-emerald-500"}`}>
                      {data.consolidatedLTV !== null ? `${data.consolidatedLTV}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Liste épurée des établissements bancaires */}
                {data.lenderSummaries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Par établissement</p>
                    <div className="divide-y divide-gray-50">
                      {data.lenderSummaries.map((ls) => (
                        <div key={ls.lender} className="flex items-center gap-3 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-brand-deep)] truncate">{ls.lender}</p>
                            <p className="text-[10px] text-[#94A3B8]">{ls.loanCount} emprunt{ls.loanCount > 1 ? "s" : ""} · {fmt(ls.monthlyPayment)}/mois</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(ls.remainingBalance)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 w-20">
                            <div className="h-1.5 flex-1 rounded-full bg-[#F1F5F9] overflow-hidden">
                              <div className="h-full rounded-full bg-brand-gradient-soft" style={{ width: ls.pctRepaid + "%" }} />
                            </div>
                            <span className="tabular-nums text-[10px] text-[#94A3B8] w-7 text-right">{ls.pctRepaid}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Performance par société */}
          <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
            <CardHeader className="pb-3 px-6 pt-5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Revenus & Trésorerie</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5 space-y-4">
              {/* KPIs revenus */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                  <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Loyers mensuels HT</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalMonthlyRentHT)}</p>
                </div>
                <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                  <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Charges récupérables</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalRecoverableCharges)}</p>
                </div>
                <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                  <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Trésorerie nette</p>
                  <p className={`text-lg font-bold tabular-nums ${data.totalCash >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(data.totalCash)}</p>
                </div>
                {data.grossYield !== null && (
                  <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Rendement brut</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{data.grossYield}%</p>
                  </div>
                )}
              </div>

              {/* Tableau revenus par société */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#FAFBFC]">
                    <th className="text-left py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Société</th>
                    <th className="text-right py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Trésorerie</th>
                    <th className="text-right py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Occupation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.societies.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#F3F4F6] text-[var(--color-brand-deep)] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-[var(--color-brand-deep)] truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-right tabular-nums font-semibold ${s.cashBalance < 0 ? "text-red-500" : "text-[var(--color-brand-deep)]"}`}>
                        {fmt(s.cashBalance)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold tabular-nums text-[var(--color-brand-blue)]">{pct(s.occupiedLots, s.lots)}%</span>
                        <span className="text-[10px] text-[#94A3B8] ml-1">{s.occupiedLots}/{s.lots}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#FAFBFC] border-t border-gray-100">
                    <td className="py-3 px-4 font-semibold text-[#94A3B8]">Total</td>
                    <td className={`py-3 px-4 text-right tabular-nums font-bold ${data.totalCash < 0 ? "text-red-500" : "text-[var(--color-brand-deep)]"}`}>{fmt(data.totalCash)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold tabular-nums text-[var(--color-brand-blue)]">{data.occupancyRate}%</span>
                      <span className="text-[10px] text-[#94A3B8] ml-1">{data.totalOccupied}/{data.totalLots}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Colonne droite : Occupation + Patrimoine */}
        <div className="space-y-6">
          {/* Occupation visuelle */}
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
                  <Layers className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                </div>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Occupation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums text-[var(--color-brand-deep)]">{data.occupancyRate}%</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">{data.totalOccupied} / {data.totalLots} lots occupés</p>
                <div className="mt-3 h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full bg-brand-gradient-soft" style={{ width: data.occupancyRate + "%" }} />
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-gray-100">
                {data.societies.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg hover:bg-[#F9FAFB] transition-colors">
                    <span className="truncate text-[var(--color-brand-deep)]">{s.name}</span>
                    <span className="font-semibold tabular-nums shrink-0 ml-2 text-[var(--color-brand-blue)]">{pct(s.occupiedLots, s.lots)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Patrimoine */}
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
                  <Building2 className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                </div>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Patrimoine</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-1.5">
              {data.totalPatrimonyValue > 0 && (
                <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[var(--color-brand-light)] text-sm">
                  <span className="font-medium text-[var(--color-brand-deep)]">Valeur patrimoine</span>
                  <span className="font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalPatrimonyValue)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#F9FAFB] text-sm">
                <span className="text-[#64748B]">Immeubles</span>
                <span className="font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.totalBuildings}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#F9FAFB] text-sm">
                <span className="text-[#64748B]">Lots</span>
                <span className="font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.totalLots}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-[#F9FAFB] text-sm">
                <span className="text-[#64748B]">Baux actifs</span>
                <span className="font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.totalActiveLeases}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION ENDETTEMENT CONSOLIDÉ ── */}
      {data.totalDebt > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Endettement — colonne large */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
              <CardHeader className="pb-3 px-6 pt-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50">
                    <Banknote className="h-3.5 w-3.5 text-red-500" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Endettement consolidé</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-4">
                {/* KPIs endettement */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Capital restant dû</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalDebt)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Mensualité totale</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.totalMonthlyLoanPayment)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F9FAFB] p-4 flex flex-col justify-between min-h-[72px]">
                    <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">LTV consolidé</p>
                    <p className={`text-lg font-bold tabular-nums ${data.consolidatedLTV !== null && data.consolidatedLTV > 80 ? "text-red-500" : data.consolidatedLTV !== null && data.consolidatedLTV > 60 ? "text-amber-500" : "text-emerald-500"}`}>
                      {data.consolidatedLTV !== null ? `${data.consolidatedLTV}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Tableau endettement par société */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#FAFBFC]">
                      <th className="text-left py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Société</th>
                      <th className="text-right py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Restant dû</th>
                      <th className="text-right py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Mensualité</th>
                      <th className="text-right py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">LTV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.societies.filter((s) => s.totalDebt > 0).map((s) => (
                      <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-[#F3F4F6] text-[var(--color-brand-deep)] text-[10px] font-bold flex items-center justify-center shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-[var(--color-brand-deep)] truncate">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--color-brand-deep)]">
                          {fmt(s.totalDebt)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#64748B]">
                          {fmt(s.monthlyLoanPayment)}<span className="text-[#94A3B8]">/mois</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {s.ltv !== null ? (
                            <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] ${s.ltv > 80 ? "text-red-500" : s.ltv > 60 ? "text-amber-500" : "text-[var(--color-brand-deep)]"}`}>
                              {s.ltv}%
                            </span>
                          ) : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FAFBFC] border-t border-gray-100">
                      <td className="py-3 px-4 font-semibold text-[#94A3B8]">Total</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-[var(--color-brand-deep)]">{fmt(data.totalDebt)}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-[#64748B]">{fmt(data.totalMonthlyLoanPayment)}</td>
                      <td className="py-3 px-4 text-right">
                        {data.consolidatedLTV !== null && (
                          <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] ${data.consolidatedLTV > 80 ? "text-red-500" : data.consolidatedLTV > 60 ? "text-amber-500" : "text-[var(--color-brand-deep)]"}`}>
                            {data.consolidatedLTV}%
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Par établissement bancaire */}
          <div>
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50">
                    <Landmark className="h-3.5 w-3.5 text-red-500" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Par établissement</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="divide-y divide-gray-50">
                  {data.lenderSummaries.map((ls) => (
                    <div key={ls.lender} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-brand-deep)] truncate">{ls.lender}</p>
                        <p className="text-[10px] text-[#94A3B8]">{ls.loanCount} emprunt{ls.loanCount > 1 ? "s" : ""} · {fmt(ls.monthlyPayment)}/mois</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(ls.remainingBalance)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 w-20">
                        <div className="h-1.5 flex-1 rounded-full bg-[#F1F5F9] overflow-hidden">
                          <div className="h-full rounded-full bg-brand-gradient-soft" style={{ width: ls.pctRepaid + "%" }} />
                        </div>
                        <span className="tabular-nums text-[10px] text-[#94A3B8] w-7 text-right">{ls.pctRepaid}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── SECTION ALERTES (Impayés + Baux expirant) ── */}
      {(data.totalOverdue > 0 || data.expiringLeases.length > 0) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Impayés par ancienneté */}
          {data.totalOverdue > 0 && (
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50">
                    <Wallet className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Impayés par ancienneté</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-1.5">
                {data.overdueByAge.map((bucket) => (
                  <div key={bucket.label} className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-[#F9FAFB] text-sm">
                    <span className="text-[#64748B]">{bucket.label}</span>
                    <span className={`font-semibold tabular-nums ${bucket.amount > 0 ? "text-amber-500" : "text-[#CBD5E1]"}`}>
                      {fmt(bucket.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-amber-50 text-sm font-bold">
                  <span className="text-[var(--color-brand-deep)]">Total</span>
                  <span className="tabular-nums text-amber-600">{fmt(data.totalOverdue)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Baux expirant */}
          {data.expiringLeases.length > 0 && (
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
                    <Calendar className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Baux expirant sous 90j</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {data.expiringLeases.map((l) => (
                  <div key={l.id} className="rounded-lg bg-[#F9FAFB] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate text-[var(--color-brand-deep)]">{l.tenantName}</p>
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${l.daysLeft <= 30 ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"}`}>
                        {l.daysLeft}j
                      </span>
                    </div>
                    <p className="text-[10px] text-[#94A3B8]">{l.lotLabel} · {l.societyName}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );

  const societiesContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {societies.length} société{societies.length > 1 ? "s" : ""}
        </p>
        <Link href={`/societes/nouvelle${activePid ? `?proprietaireId=${activePid}` : ""}`}>
          <Button size="sm" className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
            <Plus className="h-4 w-4" />
            Nouvelle société
          </Button>
        </Link>
      </div>

      {societies.length === 0 ? (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-brand-light)] mb-4">
              <Building2 className="h-7 w-7 text-[var(--color-brand-blue)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">Aucune société</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez votre première société propriétaire pour commencer à gérer votre patrimoine immobilier.
            </p>
            <Link href={`/societes/nouvelle${activePid ? `?proprietaireId=${activePid}` : ""}`}>
              <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
                <Plus className="h-4 w-4" />
                Créer une société
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {societies.map((society) => (
            <Link key={society.id} href={`/societes/${society.id}`}>
              <Card className="border-0 shadow-brand bg-white rounded-xl hover:shadow-brand-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-[var(--color-brand-deep)]">{society.name}</CardTitle>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${society.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                      {society.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <CardDescription>
                    {society.legalForm} &bull; {society.siret}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{society.city}</span>
                    <Badge variant="outline">
                      {ROLE_LABELS[society.role as UserRole]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Propriétaire</h1>
            <p className="text-sm text-muted-foreground">
              {data.totalSocieties} société{data.totalSocieties > 1 ? "s" : ""} · {data.totalBuildings} immeuble{data.totalBuildings > 1 ? "s" : ""} · {data.totalLots} lots
            </p>
          </div>
          <ProprietaireSelector
            proprietaires={proprietaires.map((p) => ({
              id: p.id,
              label: p.label,
              societyCount: p.societyCount,
            }))}
            activeId={activePid}
          />
        </div>
        <div className="flex items-center gap-2">
          {claimable.length > 0 && <ClaimSocietyDialog societies={claimable} />}
        </div>
      </div>

      <ProprietaireTabs
        dashboardContent={dashboardContent}
        profileContent={profile ? <OwnerProfileForm profile={profile} /> : null}
        societiesContent={societiesContent}
      />
    </div>
  );
}
