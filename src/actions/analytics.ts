"use server";

import { getOptionalAuthenticatedActionContext } from "@/lib/action-auth";
import { getOptionalSocietyActionContext } from "@/lib/action-society";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { buildLenderMapping } from "@/lib/utils";

export type MonthlyRevenue = { month: string; revenue: number };
export type BuildingOccupancy = { name: string; occupied: number; vacant: number; total: number; rate: number };
export type OverdueByAge = { label: string; count: number; amount: number };
export type PatrimonyPoint = { date: string; value: number };
export type TopTenant = { name: string; total: number };
export type RiskConcentrationItem = { name: string; annualRent: number; pct: number };
export type RiskConcentration = { byBuilding: RiskConcentrationItem[]; byTenant: RiskConcentrationItem[]; hhiBuilding: number; hhiTenant: number };
export type LeaseTimelineItem = { id: string; tenantName: string; lotRef: string; startDate: string; endDate: string; daysRemaining: number; progressPct: number };
export type AnalyticsKpis = { currentMonthRevenue: number; prevMonthRevenue: number; revenueChange: number; occupancyRate: number; totalOverdueAmount: number; expiringLeaseCount: number; grossYield: number | null; availableCash: number; monthlyRentHT: number; recoverableCharges: number; totalDebt: number; monthlyLoanPayment: number; activeLoanCount: number; patrimonyValue: number; ltv: number | null; totalBuildings: number; totalLots: number; occupiedLots: number; vacantLots: number; totalTenants: number; activeLeaseCount: number; expiringDiagnosticCount: number; openMaintenanceCount: number; unpaidInvoiceCount: number; totalManagementFees: number; pendingRevisionCount: number; invoicesToIssueCount: number };
export type LenderSummary = { lender: string; loanCount: number; totalCapital: number; remainingBalance: number; monthlyPayment: number; pctRepaid: number };
export type AnalyticsData = { kpis: AnalyticsKpis; monthlyRevenue: MonthlyRevenue[]; buildingOccupancy: BuildingOccupancy[]; overdueByAge: OverdueByAge[]; patrimonyPoints: PatrimonyPoint[]; topTenants: TopTenant[]; riskConcentration: RiskConcentration; leaseTimeline: LeaseTimelineItem[]; lenderSummaries: LenderSummary[] };
type AnalyticsCoreOptions = { includeTopTenants?: boolean };

function displayTenantName(t: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null }): string {
  if (t.entityType === "PERSONNE_MORALE") return t.companyName ?? "—";
  return (((t.firstName ?? "") + " " + (t.lastName ?? "")).trim()) || "—";
}

/** Normalise un nom de locataire pour regrouper les variantes (casse, accents, espaces). */
function normalizeTenantKey(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

const FREQ_MULT: Record<string, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };

async function fetchAnalyticsCore(societyIds: string[], options: AnalyticsCoreOptions = {}): Promise<AnalyticsData> {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const monthlyRevenuePromise = prisma.$queryRaw<Array<{ month: Date; revenue: number }>>`
    SELECT
      DATE_TRUNC('month', "issueDate") AS month,
      COALESCE(SUM("totalTTC"), 0)::float AS revenue
    FROM "Invoice"
    WHERE "societyId" = ANY(${societyIds})
      AND "invoiceType" != 'AVOIR'
      AND "issueDate" >= ${twelveMonthsAgo}
    GROUP BY DATE_TRUNC('month', "issueDate")
    ORDER BY month ASC
  `;
  const revenueAggPromise = Promise.all([
    prisma.invoice.aggregate({
      where: { societyId: { in: societyIds }, invoiceType: { not: "AVOIR" }, issueDate: { gte: currentMonthStart } },
      _sum: { totalTTC: true },
    }),
    prisma.invoice.aggregate({
      where: { societyId: { in: societyIds }, invoiceType: { not: "AVOIR" }, issueDate: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalTTC: true },
    }),
  ]);
  const buildingsRawPromise = prisma.building.findMany({
    where: { societyId: { in: societyIds } },
    select: { name: true, lots: { select: { status: true } } },
  });
  const overdueInvoicesPromise = prisma.invoice.findMany({
    where: {
      societyId: { in: societyIds },
      invoiceType: { not: "AVOIR" },
      OR: [
        { status: "EN_RETARD" },
        { status: "EN_ATTENTE", dueDate: { lt: now } },
        { status: "PARTIELLEMENT_PAYE", dueDate: { lt: now } },
      ],
    },
    select: { totalTTC: true, dueDate: true },
  });
  const buildingsForPatrimonyPromise = prisma.building.findMany({
    where: { societyId: { in: societyIds } },
    select: {
      id: true, acquisitionDate: true, marketValue: true, acquisitionPrice: true,
      acquisitionFees: true, acquisitionTaxes: true, acquisitionOtherCosts: true, worksCost: true,
      additionalAcquisitions: { select: { acquisitionPrice: true, acquisitionFees: true, acquisitionTaxes: true, otherCosts: true } },
    },
    orderBy: { acquisitionDate: "asc" },
  });
  const latestValuationsPromise = prisma.propertyValuation.findMany({
    where: { societyId: { in: societyIds }, status: "COMPLETED", estimatedValueMid: { not: null } },
    orderBy: { valuationDate: "desc" },
    select: { buildingId: true, estimatedValueMid: true },
  });
  const topTenantsPromise = options.includeTopTenants
    ? prisma.$queryRaw<
        Array<{ tenantId: string; total: number; companyName: string | null; firstName: string | null; lastName: string | null; entityType: string }>
      >`
        SELECT
          i."tenantId",
          SUM(i."totalTTC")::float AS total,
          t."companyName", t."firstName", t."lastName", t."entityType"
        FROM "Invoice" i
        JOIN "Tenant" t ON t.id = i."tenantId"
        WHERE i."societyId" = ANY(${societyIds})
          AND i."invoiceType" != 'AVOIR'
        GROUP BY i."tenantId", t."companyName", t."firstName", t."lastName", t."entityType"
        ORDER BY total DESC
        LIMIT 5
      `
    : Promise.resolve<Array<{ tenantId: string; total: number; companyName: string | null; firstName: string | null; lastName: string | null; entityType: string }>>([]);
  const riskLeasesPromise = prisma.lease.findMany({
    where: { societyId: { in: societyIds }, status: "EN_COURS" },
    select: {
      currentRentHT: true,
      paymentFrequency: true,
      tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
      lot: { select: { building: { select: { name: true } } } },
    },
  });
  const activeLeasesPromise = prisma.lease.findMany({
    where: { societyId: { in: societyIds }, status: "EN_COURS" },
    select: {
      id: true, startDate: true, endDate: true,
      tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
      lot: { select: { number: true, building: { select: { name: true } } } },
    },
    orderBy: { endDate: "asc" },
    take: 10,
  });
  const bankAggPromise = prisma.bankAccount.aggregate({
    where: { societyId: { in: societyIds }, isActive: true },
    _sum: { currentBalance: true },
  });
  const expiringLeaseCountPromise = prisma.lease.count({
    where: { societyId: { in: societyIds }, status: "EN_COURS", endDate: { lte: in90Days } },
  });
  const activeLeasesForRentPromise = prisma.lease.findMany({
    where: { societyId: { in: societyIds }, status: "EN_COURS" },
    select: { currentRentHT: true },
  });
  const recoverableChargesAggPromise = prisma.charge.aggregate({
    where: {
      societyId: { in: societyIds },
      date: { gte: twelveMonthsAgo },
      category: { nature: { in: ["RECUPERABLE", "MIXTE"] } },
    },
    _sum: { amount: true },
  });
  const activeLoansForDebtPromise = prisma.loan.findMany({
    where: { societyId: { in: societyIds }, status: "EN_COURS" },
    select: {
      id: true, amount: true, purchaseValue: true, lender: true,
      amortizationLines: {
        orderBy: { period: "desc" },
        where: { dueDate: { lte: now } },
        take: 1,
        select: { remainingBalance: true, totalPayment: true },
      },
    },
  });
  const dashboardCountsPromise = Promise.all([
    prisma.building.count({ where: { societyId: { in: societyIds } } }),
    prisma.tenant.count({ where: { societyId: { in: societyIds }, isActive: true } }),
    prisma.lease.count({ where: { societyId: { in: societyIds }, status: "EN_COURS" } }),
    prisma.diagnostic.count({ where: { building: { societyId: { in: societyIds } }, expiresAt: { lte: in90Days, gte: now } } }),
    prisma.maintenance.count({ where: { building: { societyId: { in: societyIds } }, completedAt: null } }),
    prisma.invoice.count({ where: { societyId: { in: societyIds }, invoiceType: { not: "AVOIR" }, status: { in: ["EN_RETARD", "EN_ATTENTE", "PARTIELLEMENT_PAYE"] }, dueDate: { lt: now } } }),
  ]);
  const managementFeesAggPromise = prisma.invoice.aggregate({
    where: {
      societyId: { in: societyIds },
      isThirdPartyManaged: true,
      issueDate: { gte: twelveMonthsAgo },
      invoiceType: { not: "AVOIR" },
    },
    _sum: { managementFeeTTC: true },
  });
  const pendingRevisionCountPromise = prisma.rentRevision.count({
    where: { isValidated: false, lease: { societyId: { in: societyIds }, status: "EN_COURS" } },
  });
  const leasesWithCurrentInvoicePromise = prisma.invoice.findMany({
    where: {
      societyId: { in: societyIds },
      issueDate: { gte: currentMonthStart },
      invoiceType: { in: ["APPEL_LOYER", "QUITTANCE"] },
    },
    select: { leaseId: true },
    distinct: ["leaseId"],
  });
  const [
    rawMonthly,
    [currentMonthAgg, prevMonthAgg],
    buildingsRaw,
    overdueInvoices,
    [buildingsForPatrimony, latestValuations],
    topTenantsRaw,
    riskLeases,
    activeLeases,
    bankAgg,
    expiringLeaseCount,
    activeLeasesForRent,
    recoverableChargesAgg,
    activeLoansForDebt,
    [totalBuildings, totalTenants, activeLeaseCount, expiringDiagnosticCount, openMaintenanceCount, unpaidInvoiceCount],
    managementFeesAgg,
    pendingRevisionCount,
    leasesWithCurrentInvoice,
  ] = await Promise.all([
    monthlyRevenuePromise,
    revenueAggPromise,
    buildingsRawPromise,
    overdueInvoicesPromise,
    Promise.all([buildingsForPatrimonyPromise, latestValuationsPromise]),
    topTenantsPromise,
    riskLeasesPromise,
    activeLeasesPromise,
    bankAggPromise,
    expiringLeaseCountPromise,
    activeLeasesForRentPromise,
    recoverableChargesAggPromise,
    activeLoansForDebtPromise,
    dashboardCountsPromise,
    managementFeesAggPromise,
    pendingRevisionCountPromise,
    leasesWithCurrentInvoicePromise,
  ]);

  // 1. Revenus mensuels (SQL raw — ANY fonctionne aussi avec un seul élément)
  const monthlyMap = new Map<string, number>();
  for (const r of rawMonthly) {
    const d = new Date(r.month);
    monthlyMap.set(`${d.getFullYear()}-${d.getMonth()}`, Number(r.revenue));
  }
  const monthlyRevenue: MonthlyRevenue[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      month: monthLabel(d),
      revenue: monthlyMap.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
    };
  });

  // 2. KPI revenus mois courant vs précédent
  const currentMonthRevenue = currentMonthAgg._sum.totalTTC ?? 0;
  const prevMonthRevenue = prevMonthAgg._sum.totalTTC ?? 0;
  const revenueChange =
    prevMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : currentMonthRevenue > 0 ? 100 : 0;

  // 3. Taux d'occupation par immeuble
  const buildingOccupancy: BuildingOccupancy[] = buildingsRaw
    .filter((b) => b.lots.length > 0)
    .map((b) => {
      const total = b.lots.length;
      const occupied = b.lots.filter((l) => l.status === "OCCUPE").length;
      return {
        name: b.name.length > 22 ? b.name.slice(0, 20) + "…" : b.name,
        total, occupied, vacant: total - occupied,
        rate: Math.round((occupied / total) * 100),
      };
    });

  const totalLots = buildingOccupancy.reduce((s, b) => s + b.total, 0);
  const occupiedLots = buildingOccupancy.reduce((s, b) => s + b.occupied, 0);
  const occupancyRate = totalLots > 0 ? Math.round((occupiedLots / totalLots) * 100) : 0;

  // 4. Impayés par ancienneté
  const ageBuckets = [
    { label: "< 30 j", min: 0, max: 30 },
    { label: "30-60 j", min: 30, max: 60 },
    { label: "60-90 j", min: 60, max: 90 },
    { label: "> 90 j", min: 90, max: Infinity },
  ];
  const overdueByAge: OverdueByAge[] = ageBuckets.map(({ label, min, max }) => {
    const bucket = overdueInvoices.filter((inv) => {
      const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      return days >= min && days < max;
    });
    return { label, count: bucket.length, amount: bucket.reduce((s, i) => s + i.totalTTC, 0) };
  });
  const totalOverdueAmount = overdueInvoices.reduce((s, i) => s + i.totalTTC, 0);

  // 5. Évolution patrimoine (cumul par date d'acquisition)
  const valuationMap = new Map<string, number>();
  for (const v of latestValuations) {
    if (!valuationMap.has(v.buildingId) && v.estimatedValueMid != null) {
      valuationMap.set(v.buildingId, v.estimatedValueMid);
    }
  }

  let cumulative = 0;
  const patrimonyPoints: PatrimonyPoint[] = [];
  for (const b of buildingsForPatrimony) {
    // Priorité : évaluation IA > marketValue > acquisitionPrice
    const aiValue = valuationMap.get(b.id);
    cumulative += aiValue ?? b.marketValue ?? b.acquisitionPrice ?? 0;
    if (b.acquisitionDate) {
      patrimonyPoints.push({
        date: new Date(b.acquisitionDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
        value: cumulative,
      });
    }
  }
  if (patrimonyPoints.length === 0 && cumulative > 0) {
    patrimonyPoints.push({ date: "Actuel", value: cumulative });
  }

  // 6. Top 5 locataires (SQL raw)
  const topTenants: TopTenant[] = topTenantsRaw.map((r) => ({
    name: displayTenantName({ entityType: r.entityType, companyName: r.companyName, firstName: r.firstName, lastName: r.lastName }),
    total: Number(r.total),
  }));

  // 6b. Concentration du risque (par immeuble et par locataire)
  const buildingRentMap = new Map<string, number>();
  const tenantRentMap = new Map<string, number>();
  const tenantDisplayNames = new Map<string, string>();
  for (const l of riskLeases) {
    const annual = l.currentRentHT * (FREQ_MULT[l.paymentFrequency] ?? 12);
    const bName = l.lot.building.name;
    buildingRentMap.set(bName, (buildingRentMap.get(bName) ?? 0) + annual);
    const tName = displayTenantName(l.tenant);
    const tKey = normalizeTenantKey(tName);
    tenantRentMap.set(tKey, (tenantRentMap.get(tKey) ?? 0) + annual);
    if (!tenantDisplayNames.has(tKey)) tenantDisplayNames.set(tKey, tName);
  }
  const totalAnnualRentRisk = riskLeases.reduce((s, l) => s + l.currentRentHT * (FREQ_MULT[l.paymentFrequency] ?? 12), 0);
  const toRiskItems = (m: Map<string, number>, displayMap?: Map<string, string>) =>
    [...m.entries()]
      .map(([key, annualRent]) => ({ name: displayMap?.get(key) ?? key, annualRent, pct: totalAnnualRentRisk > 0 ? Math.round((annualRent / totalAnnualRentRisk) * 1000) / 10 : 0 }))
      .sort((a, b) => b.pct - a.pct);
  // Indice Herfindahl-Hirschman (0 = diversifié, 10000 = concentré)
  const hhi = (items: { pct: number }[]) => Math.round(items.reduce((s, i) => s + i.pct * i.pct, 0));
  const byBuilding = toRiskItems(buildingRentMap);
  const byTenant = toRiskItems(tenantRentMap, tenantDisplayNames);
  const riskConcentration: RiskConcentration = { byBuilding, byTenant, hhiBuilding: hhi(byBuilding), hhiTenant: hhi(byTenant) };

  // 7. Échéancier baux (10 plus proches expirations)
  const leaseTimeline: LeaseTimelineItem[] = activeLeases.map((l) => {
    const start = new Date(l.startDate).getTime();
    const end = new Date(l.endDate).getTime();
    const progressPct = end > start ? Math.min(100, Math.max(0, Math.round(((now.getTime() - start) / (end - start)) * 100))) : 0;
    return {
      id: l.id,
      tenantName: displayTenantName(l.tenant),
      lotRef: `${l.lot.building.name} — Lot ${l.lot.number}`,
      startDate: new Date(l.startDate).toLocaleDateString("fr-FR"),
      endDate: new Date(l.endDate).toLocaleDateString("fr-FR"),
      daysRemaining: Math.ceil((end - now.getTime()) / 86400000),
      progressPct,
    };
  });

  // 8. Rendement brut (basé sur la valeur vénale actualisée)
  const annualRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
  const totalPatrimony = buildingsForPatrimony.reduce((s, b) => {
    const aiValue = valuationMap.get(b.id);
    return s + (aiValue ?? b.marketValue ?? b.acquisitionPrice ?? 0);
  }, 0);
  const grossYield = totalPatrimony > 0 ? Math.round((annualRevenue / totalPatrimony) * 1000) / 10 : null;

  // 9. Trésorerie
  const availableCash = bankAgg._sum.currentBalance ?? 0;

  // 10. Baux expirant dans 90j

  // 11. Loyers mensuels HT (baux actifs)
  const monthlyRentHT = activeLeasesForRent.reduce((s, l) => s + l.currentRentHT, 0);

  // 12. Charges récupérables (12 derniers mois)
  const recoverableCharges = recoverableChargesAgg._sum.amount ?? 0;

  // 13. Dette (emprunts en cours)
  let totalDebt = 0;
  let monthlyLoanPayment = 0;
  for (const loan of activeLoansForDebt) {
    if (loan.amortizationLines.length > 0) {
      totalDebt += loan.amortizationLines[0].remainingBalance;
      monthlyLoanPayment += loan.amortizationLines[0].totalPayment;
    } else {
      totalDebt += loan.amount;
    }
  }
  const activeLoanCount = activeLoansForDebt.length;

  // LTV basé sur le coût complet (prix + frais + taxes + travaux + acquisitions complémentaires)
  const totalCostForLtv = buildingsForPatrimony.reduce((s, b) => {
    let cost = (b.acquisitionPrice ?? 0) + (b.acquisitionFees ?? 0) + (b.acquisitionTaxes ?? 0) + (b.acquisitionOtherCosts ?? 0) + (b.worksCost ?? 0);
    for (const aa of b.additionalAcquisitions) {
      cost += (aa.acquisitionPrice ?? 0) + (aa.acquisitionFees ?? 0) + (aa.acquisitionTaxes ?? 0) + (aa.otherCosts ?? 0);
    }
    return s + cost;
  }, 0);
  const patrimonyValue = totalPatrimony;
  const ltv = totalCostForLtv > 0 ? Math.round((totalDebt / totalCostForLtv) * 1000) / 10 : null;

  // 14. Compteurs de patrimoine et alertes
  const vacantLots = totalLots - occupiedLots;

  // Encours par établissement prêteur
  const rawLenderNames = activeLoansForDebt.map((l) => l.lender || "Autre");
  const lenderNameMapping = buildLenderMapping(rawLenderNames);
  const lenderMap = new Map<string, { loanCount: number; totalCapital: number; remainingBalance: number; monthlyPayment: number }>();
  for (const loan of activeLoansForDebt) {
    const rawName = loan.lender || "Autre";
    const lender = lenderNameMapping.get(rawName) ?? rawName;
    const prev = lenderMap.get(lender) ?? { loanCount: 0, totalCapital: 0, remainingBalance: 0, monthlyPayment: 0 };
    const line = loan.amortizationLines[0];
    lenderMap.set(lender, {
      loanCount: prev.loanCount + 1,
      totalCapital: prev.totalCapital + Number(loan.amount),
      remainingBalance: prev.remainingBalance + (line ? Number(line.remainingBalance) : Number(loan.amount)),
      monthlyPayment: prev.monthlyPayment + (line ? Number(line.totalPayment) : 0),
    });
  }
  const lenderSummaries: LenderSummary[] = [...lenderMap.entries()]
    .map(([lender, v]) => ({
      lender,
      ...v,
      pctRepaid: v.totalCapital > 0 ? Math.round(((v.totalCapital - v.remainingBalance) / v.totalCapital) * 100) : 0,
    }))
    .sort((a, b) => b.remainingBalance - a.remainingBalance);

  // 15. Honoraires de gestion tiers (12 derniers mois)
  const totalManagementFees = managementFeesAgg._sum.managementFeeTTC ?? 0;

  // 16. Révisions de loyer en attente

  // 17. Baux sans facture émise ce mois
  const leaseIdsWithInvoice = new Set(leasesWithCurrentInvoice.map(i => i.leaseId).filter(Boolean));
  const invoicesToIssueCount = await prisma.lease.count({
    where: {
      societyId: { in: societyIds },
      status: "EN_COURS",
      isThirdPartyManaged: false,
      ...(leaseIdsWithInvoice.size > 0 ? { id: { notIn: [...leaseIdsWithInvoice] as string[] } } : {}),
    },
  });

  return {
    kpis: { currentMonthRevenue, prevMonthRevenue, revenueChange, occupancyRate, totalOverdueAmount, expiringLeaseCount, grossYield, availableCash, monthlyRentHT, recoverableCharges, totalDebt, monthlyLoanPayment, activeLoanCount, patrimonyValue, ltv, totalBuildings, totalLots, occupiedLots, vacantLots, totalTenants, activeLeaseCount, expiringDiagnosticCount, openMaintenanceCount, unpaidInvoiceCount, totalManagementFees, pendingRevisionCount, invoicesToIssueCount },
    monthlyRevenue, buildingOccupancy, overdueByAge, patrimonyPoints, topTenants, riskConcentration, leaseTimeline, lenderSummaries,
  };
}

export async function getAnalyticsData(societyId: string, options: AnalyticsCoreOptions = {}): Promise<AnalyticsData | null> {
  if (!(await getOptionalSocietyActionContext(societyId))) return null;
  const cacheKeySuffix = options.includeTopTenants ? "with-top-tenants" : "base";
  return unstable_cache(
    () => fetchAnalyticsCore([societyId], options),
    [`dashboard-analytics-${societyId}-${cacheKeySuffix}`],
    { revalidate: 300, tags: [`society-${societyId}-analytics`] }
  )();
}

export async function getConsolidatedAnalyticsData(proprietaireId?: string): Promise<AnalyticsData | null> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return null;

  const where = proprietaireId
    ? { proprietaireId, proprietaire: { userId: context.userId } }
    : { ownerId: context.userId };

  const societies = await prisma.society.findMany({
    where,
    select: { id: true },
  });

  if (societies.length === 0) return null;

  const societyIds = societies.map((s) => s.id);
  const cacheKey = proprietaireId
    ? `owner-consolidated-${proprietaireId}`
    : `owner-consolidated-${context.userId}`;

  return unstable_cache(
    () => fetchAnalyticsCore(societyIds),
    [cacheKey],
    { revalidate: 300, tags: societyIds.map((id) => `society-${id}-analytics`) }
  )();
}
