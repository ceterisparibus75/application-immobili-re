"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { unstable_cache } from "next/cache";
import { buildLenderMapping } from "@/lib/utils";

export type MonthlyRevenue = { month: string; revenue: number };
export type BuildingOccupancy = { name: string; occupied: number; vacant: number; total: number; rate: number };
export type OverdueByAge = { label: string; count: number; amount: number };
export type PatrimonyPoint = { date: string; value: number };
export type TopTenant = { name: string; total: number };
export type LeaseTimelineItem = { id: string; tenantName: string; lotRef: string; startDate: string; endDate: string; daysRemaining: number; progressPct: number };
export type AnalyticsKpis = { currentMonthRevenue: number; prevMonthRevenue: number; revenueChange: number; occupancyRate: number; totalOverdueAmount: number; expiringLeaseCount: number; grossYield: number | null; availableCash: number; monthlyRentHT: number; recoverableCharges: number; totalDebt: number; monthlyLoanPayment: number; activeLoanCount: number; patrimonyValue: number; ltv: number | null; totalBuildings: number; totalLots: number; occupiedLots: number; vacantLots: number; totalTenants: number; activeLeaseCount: number; expiringDiagnosticCount: number; openMaintenanceCount: number; unpaidInvoiceCount: number };
export type LenderSummary = { lender: string; loanCount: number; totalCapital: number; remainingBalance: number; monthlyPayment: number; pctRepaid: number };
export type AnalyticsData = { kpis: AnalyticsKpis; monthlyRevenue: MonthlyRevenue[]; buildingOccupancy: BuildingOccupancy[]; overdueByAge: OverdueByAge[]; patrimonyPoints: PatrimonyPoint[]; topTenants: TopTenant[]; leaseTimeline: LeaseTimelineItem[]; lenderSummaries: LenderSummary[] };

function displayTenantName(t: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null }): string {
  if (t.entityType === "PERSONNE_MORALE") return t.companyName ?? "—";
  return (t.firstName ?? "" + " " + (t.lastName ?? "")).trim() || "—";
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

async function fetchAnalytics(societyId: string): Promise<AnalyticsData> {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // 1. Revenus mensuels (SQL raw)
  const rawMonthly = await prisma.$queryRaw<Array<{ month: Date; revenue: number }>>`
    SELECT
      DATE_TRUNC('month', "issueDate") AS month,
      COALESCE(SUM("totalTTC"), 0)::float AS revenue
    FROM "Invoice"
    WHERE "societyId" = ${societyId}
      AND "invoiceType" != 'AVOIR'
      AND "issueDate" >= ${twelveMonthsAgo}
    GROUP BY DATE_TRUNC('month', "issueDate")
    ORDER BY month ASC
  `;

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

  // 2. KPI revenus mois courant vs precedent
  const [currentMonthAgg, prevMonthAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { societyId, invoiceType: { not: "AVOIR" }, issueDate: { gte: currentMonthStart } },
      _sum: { totalTTC: true },
    }),
    prisma.invoice.aggregate({
      where: { societyId, invoiceType: { not: "AVOIR" }, issueDate: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalTTC: true },
    }),
  ]);
  const currentMonthRevenue = currentMonthAgg._sum.totalTTC ?? 0;
  const prevMonthRevenue = prevMonthAgg._sum.totalTTC ?? 0;
  const revenueChange =
    prevMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : currentMonthRevenue > 0 ? 100 : 0;

  // 3. Taux d'occupation par immeuble
  const buildingsRaw = await prisma.building.findMany({
    where: { societyId },
    select: { name: true, lots: { select: { status: true } } },
  });
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

  // 4. Impayes par anciennete
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      societyId,
      invoiceType: { not: "AVOIR" },
      OR: [
        { status: "EN_RETARD" },
        { status: "EN_ATTENTE", dueDate: { lt: now } },
        { status: "PARTIELLEMENT_PAYE", dueDate: { lt: now } },
      ],
    },
    select: { totalTTC: true, dueDate: true },
  });
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

  // 5. Evolution patrimoine (cumul par date acquisition)
  // Récupérer la dernière évaluation COMPLETED pour chaque immeuble
  const buildingsForPatrimony = await prisma.building.findMany({
    where: { societyId },
    select: {
      id: true,
      acquisitionDate: true,
      marketValue: true,
      acquisitionPrice: true,
      propertyValuations: {
        where: { status: "COMPLETED" },
        orderBy: { valuationDate: "desc" },
        take: 1,
        select: { estimatedValueMid: true },
      },
    },
    orderBy: { acquisitionDate: "asc" },
  });
  let cumulative = 0;
  const patrimonyPoints: PatrimonyPoint[] = [];
  for (const b of buildingsForPatrimony) {
    // Priorité : évaluation IA > marketValue > acquisitionPrice
    const aiValue = b.propertyValuations[0]?.estimatedValueMid;
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
  const topTenantsRaw = await prisma.$queryRaw<
    Array<{ tenantId: string; total: number; companyName: string | null; firstName: string | null; lastName: string | null; entityType: string }>
  >`
    SELECT
      i."tenantId",
      SUM(i."totalTTC")::float AS total,
      t."companyName", t."firstName", t."lastName", t."entityType"
    FROM "Invoice" i
    JOIN "Tenant" t ON t.id = i."tenantId"
    WHERE i."societyId" = ${societyId}
      AND i."invoiceType" != 'AVOIR'
    GROUP BY i."tenantId", t."companyName", t."firstName", t."lastName", t."entityType"
    ORDER BY total DESC
    LIMIT 5
  `;
  const topTenants: TopTenant[] = topTenantsRaw.map((r) => ({
    name: displayTenantName({ entityType: r.entityType, companyName: r.companyName, firstName: r.firstName, lastName: r.lastName }),
    total: Number(r.total),
  }));

  // 7. Echeancier baux (10 soonest-expiring)
  const activeLeases = await prisma.lease.findMany({
    where: { societyId, status: "EN_COURS" },
    select: {
      id: true, startDate: true, endDate: true,
      tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
      lot: { select: { number: true, building: { select: { name: true } } } },
    },
    orderBy: { endDate: "asc" },
    take: 10,
  });
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
    const aiValue = b.propertyValuations[0]?.estimatedValueMid;
    return s + (aiValue ?? b.marketValue ?? b.acquisitionPrice ?? 0);
  }, 0);
  const grossYield = totalPatrimony > 0 ? Math.round((annualRevenue / totalPatrimony) * 1000) / 10 : null;

  // 9. Tresorerie
  const bankAgg = await prisma.bankAccount.aggregate({
    where: { societyId, isActive: true },
    _sum: { currentBalance: true },
  });
  const availableCash = bankAgg._sum.currentBalance ?? 0;

  // 10. Baux expirant 90j
  const expiringLeaseCount = await prisma.lease.count({
    where: { societyId, status: "EN_COURS", endDate: { lte: in90Days } },
  });

  // 11. Revenus mensuels HT (somme des loyers HT des baux actifs)
  const activeLeasesForRent = await prisma.lease.findMany({
    where: { societyId, status: "EN_COURS" },
    select: { currentRentHT: true },
  });
  const monthlyRentHT = activeLeasesForRent.reduce((s, l) => s + l.currentRentHT, 0);

  // 12. Charges recuperables (total sur les 12 derniers mois)
  const recoverableChargesAgg = await prisma.charge.aggregate({
    where: {
      societyId,
      date: { gte: twelveMonthsAgo },
      category: {
        nature: { in: ["RECUPERABLE", "MIXTE"] },
      },
    },
    _sum: { amount: true },
  });
  const recoverableCharges = recoverableChargesAgg._sum.amount ?? 0;

  // 13. Dette (emprunts en cours)
  const activeLoansForDebt = await prisma.loan.findMany({
    where: { societyId, status: "EN_COURS" },
    select: {
      id: true,
      amount: true,
      purchaseValue: true,
      lender: true,
      amortizationLines: {
        orderBy: { period: "desc" },
        where: { dueDate: { lte: now } },
        take: 1,
        select: { remainingBalance: true, totalPayment: true },
      },
    },
  });
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

  // Valeur patrimoine = dernière évaluation IA ou marketValue
  const patrimonyValue = totalPatrimony;
  const ltv = patrimonyValue > 0 ? Math.round((totalDebt / patrimonyValue) * 1000) / 10 : null;

  // 14. Patrimoine détaillé : immeubles, lots, locataires, baux, diagnostics, maintenances
  const in90DaysDiag = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const [totalBuildings, totalTenants, activeLeaseCount, expiringDiagnosticCount, openMaintenanceCount, unpaidInvoiceCount] = await Promise.all([
    prisma.building.count({ where: { societyId } }),
    prisma.tenant.count({ where: { societyId, isActive: true } }),
    prisma.lease.count({ where: { societyId, status: "EN_COURS" } }),
    prisma.diagnostic.count({ where: { building: { societyId }, expiresAt: { lte: in90DaysDiag, gte: now } } }),
    prisma.maintenance.count({ where: { building: { societyId }, completedAt: null } }),
    prisma.invoice.count({ where: { societyId, invoiceType: { not: "AVOIR" }, status: { in: ["EN_RETARD", "EN_ATTENTE", "PARTIELLEMENT_PAYE"] }, dueDate: { lt: now } } }),
  ]);
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

  return {
    kpis: { currentMonthRevenue, prevMonthRevenue, revenueChange, occupancyRate, totalOverdueAmount, expiringLeaseCount, grossYield, availableCash, monthlyRentHT, recoverableCharges, totalDebt, monthlyLoanPayment, activeLoanCount, patrimonyValue, ltv, totalBuildings, totalLots, occupiedLots, vacantLots, totalTenants, activeLeaseCount, expiringDiagnosticCount, openMaintenanceCount, unpaidInvoiceCount },
    monthlyRevenue, buildingOccupancy, overdueByAge, patrimonyPoints, topTenants, leaseTimeline, lenderSummaries,
  };
}

export async function getAnalyticsData(societyId: string): Promise<AnalyticsData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  await requireSocietyAccess(session.user.id, societyId);
  return unstable_cache(
    () => fetchAnalytics(societyId),
    [`dashboard-analytics-${societyId}`],
    { revalidate: 300, tags: [`society-${societyId}-analytics`] }
  )();
}
