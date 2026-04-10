import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOwnerAnalytics, getClaimableSocieties, getConsolidatedBuildings, getConsolidatedLeases, getConsolidatedLoans } from "@/actions/owner";
import { getConsolidatedAnalyticsData } from "@/actions/analytics";
import { getProprietaires, getProprietaire, migrateOwnerToProprietaire } from "@/actions/proprietaire";
import { getSocieties } from "@/actions/society";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, Landmark, Banknote,
  TrendingUp, Calendar, Wallet, Plus,
  ArrowUp, ArrowDown, Home, Users,
  FileText, Wrench, ChevronRight,
  CheckCircle2, AlertTriangle, Minus,
} from "lucide-react";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole, BuildingType, LeaseStatus, LeaseType, LeaseDestination, LoanStatus } from "@/generated/prisma/client";
import { ClaimSocietyDialog } from "./_components/claim-society-dialog";
import { ProprietaireTabs } from "./_components/proprietaire-tabs";
import { ProprietaireSelector } from "./_components/proprietaire-selector";
import { ProprietaireProfileForm } from "./_components/proprietaire-profile-form";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OccupancyChart } from "@/components/dashboard/occupancy-chart";
import { OverdueChart } from "@/components/dashboard/overdue-chart";
import { PatrimonyChart } from "@/components/dashboard/patrimony-chart";
import { RiskConcentrationChart } from "@/components/dashboard/risk-concentration-chart";
import { LeaseTimeline } from "@/components/dashboard/lease-timeline";
import { TodayTasks } from "@/components/dashboard/today-tasks";

export const metadata = { title: "Vue propriétaire" };

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(occupied: number, total: number) {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100);
}

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau", COMMERCE: "Commerce", MIXTE: "Mixte", ENTREPOT: "Entrepôt",
};

const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  EN_COURS: "En cours", RESILIE: "Résilié", RENOUVELE: "Renouvelé",
  EN_NEGOCIATION: "En négociation", CONTENTIEUX: "Contentieux",
};

const LEASE_STATUS_COLORS: Record<LeaseStatus, string> = {
  EN_COURS: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]",
  RESILIE: "bg-gray-100 text-gray-500",
  RENOUVELE: "bg-blue-50 text-blue-600",
  EN_NEGOCIATION: "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]",
  CONTENTIEUX: "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]",
};

const LEASE_TYPE_LABELS: Record<LeaseType, string> = {
  HABITATION: "Habitation", MEUBLE: "Meublé", ETUDIANT: "Étudiant", MOBILITE: "Mobilité",
  COLOCATION: "Colocation", SAISONNIER: "Saisonnier", LOGEMENT_FONCTION: "Logement fonction",
  ANAH: "ANAH", CIVIL: "Civil", GLISSANT: "Glissant", SOUS_LOCATION: "Sous-location",
  COMMERCIAL_369: "3-6-9", DEROGATOIRE: "Dérogatoire", PRECAIRE: "Précaire",
  BAIL_PROFESSIONNEL: "Professionnel", MIXTE: "Mixte", EMPHYTEOTIQUE: "Emphytéotique",
  CONSTRUCTION: "Construction", REHABILITATION: "Réhabilitation", BRS: "BRS", RURAL: "Rural",
};

const DESTINATION_LABELS: Record<LeaseDestination, string> = {
  HABITATION: "Habitation", BUREAU: "Bureau", COMMERCE: "Commerce", ACTIVITE: "Activité",
  ENTREPOT: "Entrepôt", INDUSTRIEL: "Industriel", PROFESSIONNEL: "Professionnel",
  MIXTE: "Mixte", PARKING: "Parking", TERRAIN: "Terrain", AGRICOLE: "Agricole",
  HOTELLERIE: "Hôtellerie", EQUIPEMENT: "Équipement", AUTRE: "Autre",
};

const LOAN_STATUS_LABELS: Record<LoanStatus, { label: string; color: string }> = {
  EN_COURS: { label: "En cours", color: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" },
  TERMINE: { label: "Terminé", color: "bg-gray-100 text-gray-500" },
  REMBOURSE_ANTICIPE: { label: "Remboursé", color: "bg-blue-50 text-blue-600" },
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  AMORTISSABLE: "Amortissable", IN_FINE: "In fine", BULLET: "Bullet",
};

const FREQ_MULT_ANNUAL: Record<string, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ProprietaireDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Migration automatique : si l'utilisateur n'a pas de proprietaire, en créer un
  let propList;
  try {
    propList = await getProprietaires();
    if (propList.success && (!propList.data || propList.data.length === 0)) {
      await migrateOwnerToProprietaire();
    }
  } catch (err) {
    console.error("[ProprietairePage] migration/propList error:", err);
    propList = { success: false as const, data: [], error: "" };
  }

  const params = await searchParams;
  const selectedPid = params.pid;

  const [propResult, claimableResult, societies] = await Promise.all([
    getProprietaires().catch((err) => { console.error("[ProprietairePage] getProprietaires error:", err); return { success: false as const, data: [] as never[], error: "" }; }),
    getClaimableSocieties().catch((err) => { console.error("[ProprietairePage] getClaimableSocieties error:", err); return { success: false as const, data: [] as never[], error: "" }; }),
    getSocieties().catch((err) => { console.error("[ProprietairePage] getSocieties error:", err); return []; }),
  ]);

  const proprietaires = propResult.success ? (propResult.data ?? []) : [];
  const activePid = selectedPid && proprietaires.find((p) => p.id === selectedPid)
    ? selectedPid
    : proprietaires[0]?.id ?? null;

  // Charger les analytics consolidées (même format que le dashboard société) + les analytics owner (pour le tableau par société)
  const [consolidatedData, ownerResult, proprietaireDetail, buildingsResult, leasesResult, loansResult] = await Promise.all([
    getConsolidatedAnalyticsData(activePid ?? undefined),
    getOwnerAnalytics(activePid ?? undefined),
    activePid ? getProprietaire(activePid) : Promise.resolve({ success: false as const, data: undefined, error: "" }),
    getConsolidatedBuildings(activePid ?? undefined),
    getConsolidatedLeases(activePid ?? undefined),
    getConsolidatedLoans(activePid ?? undefined),
  ]);

  const claimable = claimableResult.success ? (claimableResult.data ?? []) : [];
  const activePropDetail = proprietaireDetail.success ? proprietaireDetail.data : null;
  const ownerData = ownerResult.success ? ownerResult.data : null;

  if (!consolidatedData && (!ownerData || ownerData.totalSocieties === 0) && claimable.length === 0 && proprietaires.length === 0) {
    redirect("/proprietaire/setup");
  }

  // Données consolidées pour les graphiques (même format que dashboard société)
  const data = consolidatedData;
  // Données owner pour les tableaux par société
  const ownerSocieties = ownerData?.societies ?? [];
  const ownerSocietyIds = ownerSocieties.map((s) => s.id);
  // Données consolidées pour les onglets
  const consolidatedBuildings = buildingsResult.success ? (buildingsResult.data ?? []) : [];
  const consolidatedLeases = leasesResult.success ? (leasesResult.data ?? []) : [];
  const consolidatedLoans = loansResult.success ? (loansResult.data ?? []) : [];

  const dashboardContent = data ? (
    <div className="space-y-6">
      {/* ── KPI Cards (identiques au dashboard société) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Revenus du mois</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.kpis.currentMonthRevenue)}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {data.kpis.revenueChange >= 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)] px-1.5 py-0.5 rounded-full">
                <ArrowUp className="h-3 w-3" />+{data.kpis.revenueChange}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--color-status-negative)] bg-[var(--color-status-negative-bg)] px-1.5 py-0.5 rounded-full">
                <ArrowDown className="h-3 w-3" />{data.kpis.revenueChange}%
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">vs mois dernier</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Occupation</p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.occupancyRate}%</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-brand-gradient-soft transition-all" style={{ width: `${data.kpis.occupancyRate}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Impayés</p>
          <p className={"text-2xl font-semibold tabular-nums " + (data.kpis.totalOverdueAmount > 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]")}>{fmt(data.kpis.totalOverdueAmount)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">en attente de règlement</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-brand">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {data.kpis.grossYield !== null ? "Rendement brut" : "Trésorerie"}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-brand-deep)]">
            {data.kpis.grossYield !== null ? `${data.kpis.grossYield.toFixed(1)}%` : fmt(data.kpis.availableCash)}
          </p>
          {data.kpis.expiringLeaseCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)] px-1.5 py-0.5 rounded-full mt-1.5">
              <Calendar className="h-3 w-3" />
              {data.kpis.expiringLeaseCount} bail expirant sous 90j
            </span>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">aucun bail expirant</p>
          )}
        </div>
      </div>

      {/* ── Performance par société ── */}
      {ownerSocieties.length > 0 && (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-status-positive-bg)]">
                <TrendingUp className="h-4 w-4 text-[var(--color-status-positive)]" />
              </div>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Performance par société</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-gray-100 bg-muted/30">
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Société</th>
                    <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Revenus mois</th>
                    <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Trésorerie</th>
                    <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Occupation</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerSocieties.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#F3F4F6] text-[var(--color-brand-deep)] text-[10px] font-bold flex items-center justify-center shrink-0">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-[var(--color-brand-deep)] truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--color-brand-deep)]">{fmt(s.currentMonthRevenue)}</td>
                      <td className={`py-3 px-4 text-right tabular-nums font-semibold ${s.cashBalance < 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]"}`}>{fmt(s.cashBalance)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold tabular-nums text-[var(--color-brand-blue)]">{pct(s.occupiedLots, s.lots)}%</span>
                        <span className="text-[10px] text-muted-foreground ml-1">{s.occupiedLots}/{s.lots}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {ownerSocieties.length > 1 && (
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-gray-100">
                      <td className="py-3 px-4 font-semibold text-muted-foreground">Total</td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-[var(--color-brand-deep)]">{fmt(data.kpis.currentMonthRevenue)}</td>
                      <td className={`py-3 px-4 text-right tabular-nums font-bold ${data.kpis.availableCash < 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]"}`}>{fmt(data.kpis.availableCash)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold tabular-nums text-[var(--color-brand-blue)]">{data.kpis.occupancyRate}%</span>
                        <span className="text-[10px] text-muted-foreground ml-1">{data.kpis.occupiedLots}/{data.kpis.totalLots}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Endettement consolidé ── */}
      {data.kpis.activeLoanCount > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* KPI + tableau par société (2/3) */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-blue)]/10">
                    <Landmark className="h-4 w-4 text-[var(--color-brand-blue)]" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Endettement consolidé</CardTitle>
                </div>
                <CardDescription>Capital restant dû et mensualités — toutes sociétés</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-3 gap-px bg-gray-100">
                  <div className="bg-white p-4">
                    <p className="text-xs text-muted-foreground mb-1">Capital restant dû</p>
                    <p className="text-lg font-semibold tabular-nums text-[var(--color-status-negative)]">{fmt(data.kpis.totalDebt)}</p>
                  </div>
                  <div className="bg-white p-4">
                    <p className="text-xs text-muted-foreground mb-1">Mensualité totale</p>
                    <p className="text-lg font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.kpis.monthlyLoanPayment)}</p>
                  </div>
                  <div className="bg-white p-4">
                    <p className="text-xs text-muted-foreground mb-1">LTV</p>
                    <p className={"text-lg font-semibold tabular-nums " + (data.kpis.ltv !== null && data.kpis.ltv > 80 ? "text-[var(--color-status-negative)]" : data.kpis.ltv !== null && data.kpis.ltv > 60 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]")}>
                      {data.kpis.ltv !== null ? `${data.kpis.ltv}%` : "—"}
                    </p>
                  </div>
                </div>
                {/* Tableau endettement par société */}
                {ownerSocieties.filter((s) => s.totalDebt > 0).length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-gray-100 bg-muted/30">
                          <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Société</th>
                          <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Restant dû</th>
                          <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Mensualité</th>
                          <th className="text-center py-2.5 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">LTV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownerSocieties.filter((s) => s.totalDebt > 0).map((s) => (
                          <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-lg bg-[#F3F4F6] text-[var(--color-brand-deep)] text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {s.name.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-medium text-[var(--color-brand-deep)] truncate">{s.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--color-brand-deep)]">{fmt(s.totalDebt)}</td>
                            <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{fmt(s.monthlyLoanPayment)}<span className="text-[10px] text-muted-foreground">/mois</span></td>
                            <td className="py-3 px-4 text-center">
                              {s.ltv !== null ? (
                                <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] ${s.ltv > 80 ? "text-[var(--color-status-negative)]" : s.ltv > 60 ? "text-[var(--color-status-caution)]" : "text-[var(--color-brand-deep)]"}`}>{s.ltv}%</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {ownerSocieties.filter((s) => s.totalDebt > 0).length > 1 && (
                        <tfoot>
                          <tr className="bg-muted/30 border-t border-gray-100">
                            <td className="py-3 px-4 font-semibold text-muted-foreground">Total</td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-[var(--color-brand-deep)]">{fmt(data.kpis.totalDebt)}</td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-muted-foreground">{fmt(data.kpis.monthlyLoanPayment)}</td>
                            <td className="py-3 px-4 text-center">
                              {data.kpis.ltv !== null && (
                                <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] ${data.kpis.ltv > 80 ? "text-[var(--color-status-negative)]" : data.kpis.ltv > 60 ? "text-[var(--color-status-caution)]" : "text-[var(--color-brand-deep)]"}`}>{data.kpis.ltv}%</span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Par établissement bancaire (1/3) — cartes empilées lisibles */}
          {data.lenderSummaries.length > 0 && (
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-status-negative-bg)]">
                    <Banknote className="h-4 w-4 text-[var(--color-status-negative)]" />
                  </div>
                  <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Par établissement</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.lenderSummaries.map((ls) => (
                  <div key={ls.lender} className="rounded-lg bg-gray-50/80 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--color-brand-deep)]">{ls.lender}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{ls.loanCount} emprunt{ls.loanCount > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Restant dû</span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-status-negative)]">{fmt(ls.remainingBalance)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Mensualité</span>
                      <span className="text-sm tabular-nums text-[var(--color-brand-deep)]">{fmt(ls.monthlyPayment)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Remboursé</span>
                      <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-gradient-soft" style={{ width: ls.pctRepaid + "%" }} />
                        </div>
                        <span className="tabular-nums text-xs font-semibold text-[var(--color-brand-deep)] w-8 text-right">{ls.pctRepaid}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Contenu principal : Graphiques + Panneau de suivi ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne gauche : Graphiques (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Revenus mensuels</CardTitle>
              <CardDescription>Facturation TTC sur les 12 derniers mois — toutes sociétés</CardDescription>
            </CardHeader>
            <CardContent><RevenueChart data={data.monthlyRevenue} /></CardContent>
          </Card>
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Occupation par immeuble</CardTitle>
              <CardDescription>Lots occupés vs vacants — toutes sociétés</CardDescription>
            </CardHeader>
            <CardContent><OccupancyChart data={data.buildingOccupancy} globalRate={data.kpis.occupancyRate} /></CardContent>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Impayés par ancienneté</CardTitle>
                <CardDescription>Montants en souffrance</CardDescription>
              </CardHeader>
              <CardContent><OverdueChart data={data.overdueByAge} /></CardContent>
            </Card>
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Évolution patrimoine</CardTitle>
                <CardDescription>Valeur cumulée</CardDescription>
              </CardHeader>
              <CardContent><PatrimonyChart data={data.patrimonyPoints} /></CardContent>
            </Card>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Division du risque</CardTitle>
                <CardDescription>Concentration des revenus locatifs</CardDescription>
              </CardHeader>
              <CardContent><RiskConcentrationChart data={data.riskConcentration} /></CardContent>
            </Card>
            <Card className="border-0 shadow-brand bg-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Échéancier des baux</CardTitle>
                <CardDescription>Progression et fin</CardDescription>
              </CardHeader>
              <CardContent><LeaseTimeline data={data.leaseTimeline} /></CardContent>
            </Card>
          </div>
        </div>

        {/* Colonne droite : Panneau de suivi (1/3) */}
        <div className="space-y-5">
          <TodayTasks societyIds={ownerSocietyIds} />

          {/* Panneau de suivi complet */}
          <Card className="border-0 shadow-brand bg-white rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Suivi</CardTitle>
              <CardDescription>Vue complète — toutes sociétés</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Patrimoine */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Home className="h-3 w-3" /> Patrimoine
                </h4>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Sociétés</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{ownerSocieties.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Immeubles</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.totalBuildings}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Lots (occupés / vacants)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.occupiedLots} / {data.kpis.vacantLots}</span>
                    <span className={`inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${data.kpis.vacantLots === 0 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : data.kpis.vacantLots <= 2 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                      {data.kpis.vacantLots === 0 ? "Complet" : `${data.kpis.vacantLots} vacant${data.kpis.vacantLots > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Taux d&apos;occupation</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.occupancyRate}%</span>
                    <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${data.kpis.occupancyRate >= 80 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : data.kpis.occupancyRate >= 50 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                      {data.kpis.occupancyRate >= 80 ? "Bon" : data.kpis.occupancyRate >= 50 ? "Moyen" : "Faible"}
                    </span>
                  </div>
                </div>
                {data.kpis.patrimonyValue > 0 && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Valeur patrimoine</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.kpis.patrimonyValue)}</span>
                  </div>
                )}
                {data.kpis.grossYield !== null && (
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Rendement brut</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.grossYield.toFixed(1)}%</span>
                      <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${data.kpis.grossYield >= 5 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : data.kpis.grossYield >= 3 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                        {data.kpis.grossYield >= 5 ? "Bon" : data.kpis.grossYield >= 3 ? "Moyen" : "Faible"}
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
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.totalTenants}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Baux en cours</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.activeLeaseCount}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Baux expirant sous 90j</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.expiringLeaseCount}</span>
                    {data.kpis.expiringLeaseCount > 0 && (
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
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.kpis.monthlyRentHT)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Factures impayées</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.unpaidInvoiceCount}</span>
                    {data.kpis.unpaidInvoiceCount > 0 && (
                      <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]">{data.kpis.unpaidInvoiceCount}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Montant impayé</span>
                  <span className={`text-sm font-semibold tabular-nums ${data.kpis.totalOverdueAmount > 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]"}`}>{fmt(data.kpis.totalOverdueAmount)}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                  <span className="text-sm text-[var(--color-brand-deep)]">Charges récup.</span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.kpis.recoverableCharges)}</span>
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
                    <span className={`text-sm font-semibold tabular-nums ${data.kpis.availableCash >= 0 ? "text-[var(--color-brand-deep)]" : "text-[var(--color-status-negative)]"}`}>{fmt(data.kpis.availableCash)}</span>
                    <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${data.kpis.availableCash >= 0 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                      {data.kpis.availableCash >= 0 ? "OK" : "Négatif"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technique */}
              {(data.kpis.expiringDiagnosticCount > 0 || data.kpis.openMaintenanceCount > 0) && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" /> Technique
                  </h4>
                  {data.kpis.expiringDiagnosticCount > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <span className="text-sm text-[var(--color-brand-deep)]">Diagnostics expirant 90j</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.expiringDiagnosticCount}</span>
                        <span className="inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]">Attention</span>
                      </div>
                    </div>
                  )}
                  {data.kpis.openMaintenanceCount > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <span className="text-sm text-[var(--color-brand-deep)]">Maintenances en cours</span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.openMaintenanceCount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dette */}
              {data.kpis.activeLoanCount > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <Landmark className="h-3 w-3" /> Endettement
                  </h4>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Capital restant dû</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-status-negative)]">{fmt(data.kpis.totalDebt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Mensualité totale</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{fmt(data.kpis.monthlyLoanPayment)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                    <span className="text-sm text-[var(--color-brand-deep)]">Emprunts actifs</span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-deep)]">{data.kpis.activeLoanCount}</span>
                  </div>
                  {data.kpis.ltv !== null && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <span className="text-sm text-[var(--color-brand-deep)]">LTV</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${data.kpis.ltv > 80 ? "text-[var(--color-status-negative)]" : data.kpis.ltv > 60 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>{data.kpis.ltv}%</span>
                        <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${data.kpis.ltv > 80 ? "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]" : data.kpis.ltv > 60 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"}`}>
                          {data.kpis.ltv > 80 ? "Élevé" : data.kpis.ltv > 60 ? "Moyen" : "Sain"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Détail par société */}
              {ownerSocieties.length > 1 && (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <h4 className="text-[11px] font-semibold text-[var(--color-brand-blue)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> Par société
                  </h4>
                  {ownerSocieties.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-md bg-[#F3F4F6] text-[var(--color-brand-deep)] text-[9px] font-bold flex items-center justify-center shrink-0">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-[var(--color-brand-deep)] truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-semibold tabular-nums text-[var(--color-brand-blue)]">{pct(s.occupiedLots, s.lots)}%</span>
                        <span className={`text-xs font-semibold tabular-nums ${s.cashBalance < 0 ? "text-[var(--color-status-negative)]" : "text-[var(--color-brand-deep)]"}`}>{fmt(s.cashBalance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  ) : (
    <div className="text-center py-12 text-muted-foreground">
      Aucune donnée disponible
    </div>
  );

  // ── Patrimoine tab content ──
  const totalBuildingLots = consolidatedBuildings.reduce((s, b) => s + b.totalLots, 0);
  const totalBuildingOccupied = consolidatedBuildings.reduce((s, b) => s + b.occupiedLots, 0);
  const globalBuildingOccupancy = totalBuildingLots > 0 ? Math.round((totalBuildingOccupied / totalBuildingLots) * 100) : 0;
  const totalAnnualRent = consolidatedBuildings.reduce((s, b) => s + b.annualRent, 0);
  const totalCostAll = consolidatedBuildings.reduce((s, b) => s + b.totalCost, 0);
  const totalVenalValue = consolidatedBuildings.reduce((s, b) => s + (b.venalValue ?? 0), 0);

  const patrimoineContent = (
    <div className="space-y-5">
      {/* KPIs */}
      {consolidatedBuildings.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Immeubles</p>
            <p className="text-2xl font-bold tabular-nums">{consolidatedBuildings.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Occupation</p>
            <p className="text-2xl font-bold tabular-nums">{totalBuildingOccupied}/{totalBuildingLots} <span className="text-base font-medium text-muted-foreground">({globalBuildingOccupancy}%)</span></p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Revenus annuels HT</p>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalAnnualRent)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Coût complet</p>
            <p className="text-2xl font-bold tabular-nums">{totalCostAll > 0 ? fmt(totalCostAll) : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Valeur vénale totale</p>
            <p className="text-2xl font-bold tabular-nums">{totalVenalValue > 0 ? fmt(totalVenalValue) : "—"}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {consolidatedBuildings.length === 0 ? (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-1">Aucun immeuble</h3>
            <p className="text-sm text-muted-foreground">Ajoutez des immeubles dans vos sociétés pour les voir ici.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden md:grid md:grid-cols-[1fr_100px_75px_110px_110px_110px_80px_80px] gap-2 px-5 py-3 border-b bg-muted/30">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Immeuble</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Société</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Occup.</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Loyers/an</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Coût complet</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Val. vénale</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Variation</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Rendt.</span>
            </div>
            {consolidatedBuildings.map((building, index) => {
              const occupancyPctB = building.totalLots > 0 ? Math.round((building.occupiedLots / building.totalLots) * 100) : 0;
              const variation = building.totalCost > 0 && building.venalValue ? Math.round(((building.venalValue - building.totalCost) / building.totalCost) * 1000) / 10 : null;
              return (
                <Link
                  key={building.id}
                  href={`/patrimoine/immeubles/${building.id}`}
                  className={`block transition-colors hover:bg-accent/50 group ${index < consolidatedBuildings.length - 1 ? "border-b" : ""}`}
                >
                  {/* Desktop */}
                  <div className="hidden md:grid md:grid-cols-[1fr_100px_75px_110px_110px_110px_80px_80px] gap-2 items-center px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
                        <Building2 className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{building.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{BUILDING_TYPE_LABELS[building.buildingType as BuildingType] ?? building.buildingType}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                          {building.city} — {building.totalLots} lot{building.totalLots !== 1 ? "s" : ""}
                          {building.totalArea > 0 && ` — ${building.totalArea.toLocaleString("fr-FR")} m²`}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{building.societyName}</span>
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${occupancyPctB === 100 ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : occupancyPctB >= 50 ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)]" : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"}`}>
                        {building.occupiedLots}/{building.totalLots}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-right">
                      {building.annualRent > 0 ? fmt(building.annualRent) : <span className="text-muted-foreground font-normal">—</span>}
                    </span>
                    <span className="text-sm tabular-nums text-right">
                      {building.totalCost > 0 ? fmt(building.totalCost) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className="text-sm tabular-nums text-right">
                      {building.venalValue ? fmt(building.venalValue) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <div className="flex justify-center">
                      {variation !== null ? (
                        <span className={`text-sm font-semibold tabular-nums ${variation >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                          {variation >= 0 ? "+" : ""}{variation.toFixed(1)}%
                        </span>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </div>
                    <div className="flex justify-center">
                      {building.yieldRate !== null ? (
                        <span className="text-sm font-semibold tabular-nums text-[var(--color-brand-blue)]">{building.yieldRate.toFixed(1)}%</span>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold truncate">{building.name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{building.societyName}</span>
                      <span>{building.occupiedLots}/{building.totalLots} occupé{building.occupiedLots > 1 ? "s" : ""}</span>
                      {building.annualRent > 0 && <span>{fmt(building.annualRent)}/an</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Baux tab content ──
  const activeLeasesConsolidated = consolidatedLeases.filter((l) => l.status === "EN_COURS");
  const otherLeasesConsolidated = consolidatedLeases.filter((l) => l.status !== "EN_COURS");
  const totalMonthlyRent = activeLeasesConsolidated.reduce((s, l) => s + l.currentRentHT / (FREQ_MULT_ANNUAL[l.paymentFrequency] ?? 12) * 12 / 12, 0);

  const bauxContent = (
    <div className="space-y-5">
      {/* Summary */}
      {consolidatedLeases.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Baux actifs</p>
            <p className="text-2xl font-bold tabular-nums">{activeLeasesConsolidated.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Baux résiliés/autres</p>
            <p className="text-2xl font-bold tabular-nums">{otherLeasesConsolidated.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Loyer mensuel HT</p>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalMonthlyRent)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Sociétés concernées</p>
            <p className="text-2xl font-bold tabular-nums">{new Set(consolidatedLeases.map((l) => l.societyId)).size}</p>
          </div>
        </div>
      )}

      {consolidatedLeases.length === 0 ? (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-1">Aucun bail</h3>
            <p className="text-sm text-muted-foreground">Créez des baux dans vos sociétés pour les voir ici.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden md:grid md:grid-cols-[1fr_120px_100px_90px_100px_80px_80px] gap-2 px-5 py-3 border-b bg-muted/30">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Locataire / Lot</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Société</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Loyer HT</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Type</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Échéance</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Statut</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Index.</span>
            </div>
            {consolidatedLeases.map((lease, index) => {
              const hasRevision = lease.lastRevisionDate !== null;
              const revisionRecent = hasRevision && (new Date().getTime() - new Date(lease.lastRevisionDate!).getTime()) < 365 * 24 * 60 * 60 * 1000;
              const endSoon = lease.endDate && (new Date(lease.endDate).getTime() - new Date().getTime()) < 90 * 24 * 60 * 60 * 1000 && lease.status === "EN_COURS";
              return (
                <Link
                  key={lease.id}
                  href={`/baux/${lease.id}`}
                  className={`block transition-colors hover:bg-accent/50 group ${index < consolidatedLeases.length - 1 ? "border-b" : ""}`}
                >
                  {/* Desktop */}
                  <div className="hidden md:grid md:grid-cols-[1fr_120px_100px_90px_100px_80px_80px] gap-2 items-center px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{lease.tenantName}</p>
                        {endSoon && <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-caution)] shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lease.lotLabel} — {lease.buildingName}, {lease.buildingCity}</p>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{lease.societyName}</span>
                    <span className="text-sm font-medium tabular-nums text-right">{fmt(lease.currentRentHT)}</span>
                    <span className="text-xs text-center text-muted-foreground">
                      {lease.destination ? (DESTINATION_LABELS[lease.destination as LeaseDestination] ?? lease.destination) : (LEASE_TYPE_LABELS[lease.leaseType as LeaseType] ?? lease.leaseType)}
                    </span>
                    <span className="text-xs text-center text-muted-foreground">
                      {lease.endDate ? formatDate(lease.endDate) : "—"}
                    </span>
                    <div className="flex justify-center">
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEASE_STATUS_COLORS[lease.status as LeaseStatus] ?? "bg-gray-100 text-gray-500"}`}>
                        {LEASE_STATUS_LABELS[lease.status as LeaseStatus] ?? lease.status}
                      </span>
                    </div>
                    <div className="flex justify-center">
                      {!lease.indexType ? (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground/30" />
                      ) : revisionRecent ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-status-positive)]" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
                      )}
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{lease.tenantName}</span>
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEASE_STATUS_COLORS[lease.status as LeaseStatus] ?? "bg-gray-100 text-gray-500"}`}>
                        {LEASE_STATUS_LABELS[lease.status as LeaseStatus] ?? lease.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{lease.societyName}</span>
                      <span>{lease.lotLabel}</span>
                      <span>{fmt(lease.currentRentHT)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Emprunts tab content ──
  const activeLoans = consolidatedLoans.filter((l) => l.status === "EN_COURS");
  const totalCapital = consolidatedLoans.reduce((s, l) => s + l.amount, 0);
  const totalRemaining = consolidatedLoans.reduce((s, l) => s + l.remainingBalance, 0);
  const totalMonthlyPayment = activeLoans.reduce((s, l) => s + (l.remainingBalance > 0 ? l.monthlyPayment : 0), 0);

  const empruntsContent = (
    <div className="space-y-5">
      {/* KPIs */}
      {consolidatedLoans.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Capital emprunté</p>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalCapital)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Capital restant dû</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-status-negative)]">{fmt(totalRemaining)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Capital remboursé</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--color-status-positive)]">{fmt(totalCapital - totalRemaining)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Échéance mensuelle</p>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalMonthlyPayment)}</p>
          </div>
        </div>
      )}

      {consolidatedLoans.length === 0 ? (
        <Card className="border-0 shadow-brand bg-white rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Landmark className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-1">Aucun emprunt</h3>
            <p className="text-sm text-muted-foreground">Ajoutez des emprunts dans vos sociétés pour les voir ici.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="hidden md:grid md:grid-cols-[1fr_100px_100px_100px_100px_80px_80px] gap-2 px-5 py-3 border-b bg-muted/30">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Emprunt</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Société</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Capital</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Restant dû</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Mensualité</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Avancement</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Statut</span>
            </div>
            {consolidatedLoans.map((loan, index) => {
              const pctRepaid = loan.amount > 0 ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100) : 0;
              return (
                <Link
                  key={loan.id}
                  href={`/emprunts/${loan.id}`}
                  className={`block transition-colors hover:bg-accent/50 group ${index < consolidatedLoans.length - 1 ? "border-b" : ""}`}
                >
                  {/* Desktop */}
                  <div className="hidden md:grid md:grid-cols-[1fr_100px_100px_100px_100px_80px_80px] gap-2 items-center px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{loan.label}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{LOAN_TYPE_LABELS[loan.loanType] ?? loan.loanType}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {loan.lender}{loan.buildingName ? ` — ${loan.buildingName}` : ""} — {loan.interestRate}%
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{loan.societyName}</span>
                    <span className="text-sm tabular-nums text-right">{fmt(loan.amount)}</span>
                    <span className="text-sm font-medium tabular-nums text-right text-[var(--color-status-negative)]">{fmt(loan.remainingBalance)}</span>
                    <span className="text-sm tabular-nums text-right">{loan.monthlyPayment > 0 ? fmt(loan.monthlyPayment) : "—"}</span>
                    <div className="flex justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pctRepaid}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{pctRepaid}%</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${LOAN_STATUS_LABELS[loan.status as LoanStatus]?.color ?? "bg-gray-100 text-gray-500"}`}>
                        {LOAN_STATUS_LABELS[loan.status as LoanStatus]?.label ?? loan.status}
                      </span>
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{loan.label}</span>
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${LOAN_STATUS_LABELS[loan.status as LoanStatus]?.color ?? "bg-gray-100 text-gray-500"}`}>
                        {LOAN_STATUS_LABELS[loan.status as LoanStatus]?.label ?? loan.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{loan.societyName}</span>
                      <span>{loan.lender}</span>
                      <span>CRD: {fmt(loan.remainingBalance)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Profil propriétaire tab content (merged profile + societies) ──
  const profileContent = (
    <div className="space-y-6">
      {/* Formulaire profil propriétaire */}
      {activePropDetail && <ProprietaireProfileForm proprietaire={activePropDetail} />}

      {/* Sociétés */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-brand-deep)]">
            Sociétés ({societies.length})
          </h3>
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
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${society.isActive ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]" : "bg-gray-100 text-gray-500"}`}>
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
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">{activePropDetail?.label ?? "Propriétaire"}</h1>
            <p className="text-sm text-muted-foreground">
              {ownerData?.totalSocieties ?? 0} société{(ownerData?.totalSocieties ?? 0) > 1 ? "s" : ""} · {ownerData?.totalBuildings ?? 0} immeuble{(ownerData?.totalBuildings ?? 0) > 1 ? "s" : ""} · {ownerData?.totalLots ?? 0} lots
            </p>
          </div>
          <ProprietaireSelector
            proprietaires={proprietaires.map((p) => ({
              id: p.id,
              label: p.label,
              entityType: p.entityType,
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
        patrimoineContent={patrimoineContent}
        bauxContent={bauxContent}
        empruntsContent={empruntsContent}
        profileContent={profileContent}
      />
    </div>
  );
}
