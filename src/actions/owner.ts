"use server";

import {
  getOptionalAuthenticatedActionContext,
  requireAuthenticatedActionContext,
} from "@/lib/action-auth";
import { UnauthenticatedActionError } from "@/lib/action-society";
import { prisma } from "@/lib/prisma";
import { revalidatePath, unstable_cache } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { buildLenderMapping } from "@/lib/utils";

export type OwnerSocietySummary = {
  id: string;
  name: string;
  legalForm: string;
  city: string;
  logoUrl: string | null;
  buildings: number;
  lots: number;
  occupiedLots: number;
  currentMonthRevenue: number;
  overdueAmount: number;
  activeLeases: number;
  cashBalance: number;
  initialLoanCapital: number;
  totalDebt: number;
  monthlyLoanPayment: number;
  principalAmortizedMonth: number;
  principalAmortizedYTD: number;
  monthlyRentHT: number;
  patrimonyValue: number;
  ltv: number | null;
};

export type OverdueAgeBucket = {
  label: string;
  amount: number;
};

export type ExpiringLease = {
  id: string;
  societyName: string;
  tenantName: string;
  lotLabel: string;
  endDate: string;
  daysLeft: number;
};

export type LenderSummary = {
  lender: string;
  loanCount: number;
  totalCapital: number;
  remainingBalance: number;
  monthlyPayment: number;
  pctRepaid: number;
};

export type OwnerAnalytics = {
  totalSocieties: number;
  totalBuildings: number;
  totalLots: number;
  totalOccupied: number;
  totalMonthRevenue: number;
  totalOverdue: number;
  totalActiveLeases: number;
  totalCash: number;
  totalInitialLoanCapital: number;
  totalDebt: number;
  totalMonthlyLoanPayment: number;
  totalPrincipalAmortizedMonth: number;
  totalPrincipalAmortizedYTD: number;
  totalMonthlyRentHT: number;
  totalRecoverableCharges: number;
  totalPatrimonyValue: number;
  grossYield: number | null;
  consolidatedLTV: number | null;
  occupancyRate: number;
  overdueByAge: OverdueAgeBucket[];
  expiringLeases: ExpiringLease[];
  societies: OwnerSocietySummary[];
  lenderSummaries: LenderSummary[];
};

export async function getOwnerSocieties(proprietaireId?: string): Promise<ActionResult<{ id: string; name: string; legalForm: string; siret: string | null; city: string; isActive: boolean; logoUrl: string | null }[]>> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return { success: false, error: "Non authentifie" };

  const where = proprietaireId
    ? { proprietaireId, proprietaire: { userId: context.userId } }
    : { ownerId: context.userId };

  const societies = await prisma.society.findMany({
    where,
    select: { id: true, name: true, legalForm: true, siret: true, city: true, isActive: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  return { success: true, data: societies };
}

const EMPTY_ANALYTICS: OwnerAnalytics = {
  totalSocieties: 0, totalBuildings: 0, totalLots: 0, totalOccupied: 0,
  totalMonthRevenue: 0, totalOverdue: 0, totalActiveLeases: 0,
  totalCash: 0, totalInitialLoanCapital: 0, totalDebt: 0, totalMonthlyLoanPayment: 0,
  totalPrincipalAmortizedMonth: 0, totalPrincipalAmortizedYTD: 0,
  totalMonthlyRentHT: 0, totalRecoverableCharges: 0,
  totalPatrimonyValue: 0,
  grossYield: null, consolidatedLTV: null, occupancyRate: 0,
  overdueByAge: [], expiringLeases: [], societies: [],
  lenderSummaries: [],
};

const _fetchOwnerAnalyticsData = unstable_cache(
  async (userId: string, proprietaireId: string | null): Promise<OwnerAnalytics> => {
    const where = proprietaireId
      ? { proprietaireId, proprietaire: { userId } }
      : { ownerId: userId };

    const ownedSocieties = await prisma.society.findMany({
      where,
      select: { id: true, name: true, legalForm: true, city: true, logoUrl: true },
      orderBy: { name: "asc" },
    });

    if (ownedSocieties.length === 0) return EMPTY_ANALYTICS;

    const ids = ownedSocieties.map((s) => s.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      buildings, lots, activeLeases, monthRevAgg, overdueInvoices,
      bankAccounts, loans, allOverdue, expiringLeasesRaw, rentAgg, chargeAgg,
      amortizationLines,
    ] = await Promise.all([
      prisma.building.findMany({
        where: { societyId: { in: ids } },
        select: {
          societyId: true,
          acquisitionPrice: true,
          acquisitionFees: true,
          acquisitionTaxes: true,
          acquisitionOtherCosts: true,
          worksCost: true,
          additionalAcquisitions: {
            select: { acquisitionPrice: true, acquisitionFees: true, acquisitionTaxes: true, otherCosts: true },
          },
        },
      }),
      prisma.lot.findMany({
        where: { building: { societyId: { in: ids } } },
        select: { status: true, building: { select: { societyId: true } } },
      }),
      prisma.lease.groupBy({
        by: ["societyId"],
        where: { societyId: { in: ids }, status: "EN_COURS" },
        _count: { id: true },
      }),
      prisma.invoice.groupBy({
        by: ["societyId"],
        where: {
          societyId: { in: ids },
          invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
          OR: [
            { periodStart: { gte: monthStart } },
            { periodStart: null, issueDate: { gte: monthStart } },
          ],
        },
        _sum: { totalTTC: true },
      }),
      prisma.invoice.groupBy({
        by: ["societyId"],
        where: {
          societyId: { in: ids },
          invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
          status: { in: ["EN_ATTENTE", "PARTIELLEMENT_PAYE", "EN_RETARD"] },
          dueDate: { lt: now },
        },
        _sum: { totalTTC: true },
      }),
      prisma.bankAccount.findMany({
        where: { societyId: { in: ids }, isActive: true },
        select: { societyId: true, currentBalance: true },
      }),
      prisma.loan.findMany({
        where: { societyId: { in: ids }, status: "EN_COURS" },
        select: {
          societyId: true,
          purchaseValue: true,
          amount: true,
          lender: true,
          amortizationLines: {
            where: { dueDate: { lte: now } },
            orderBy: { period: "desc" },
            take: 1,
            select: { remainingBalance: true, totalPayment: true },
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          societyId: { in: ids },
          invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
          status: { in: ["EN_ATTENTE", "PARTIELLEMENT_PAYE", "EN_RETARD"] },
          dueDate: { lt: now },
        },
        select: { dueDate: true, totalTTC: true },
      }),
      prisma.lease.findMany({
        where: {
          societyId: { in: ids },
          status: "EN_COURS",
          endDate: { lte: in90Days, gte: now },
        },
        select: {
          id: true, endDate: true, societyId: true,
          tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
          lot: { select: { number: true, building: { select: { name: true } } } },
        },
        orderBy: { endDate: "asc" },
        take: 10,
      }),
      prisma.lease.groupBy({
        by: ["societyId"],
        where: { societyId: { in: ids }, status: "EN_COURS" },
        _sum: { currentRentHT: true },
      }),
      prisma.charge.findMany({
        where: {
          societyId: { in: ids },
          date: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
          category: { nature: { in: ["RECUPERABLE", "MIXTE"] } },
        },
        select: { amount: true },
      }),
      // Lignes d'amortissement échues à ce jour (mois + YTD).
      // On borne à `now` et pas à `monthEnd` : sinon une échéance prévue plus
      // tard dans le mois serait déjà comptée en début de mois, et le KPI
      // resterait figé au lieu de croître au fil des échéances passées.
      prisma.loanAmortizationLine.findMany({
        where: {
          loan: { societyId: { in: ids }, status: "EN_COURS" },
          dueDate: { gte: yearStart, lte: now },
        },
        select: {
          dueDate: true,
          principalPayment: true,
          loan: { select: { societyId: true } },
        },
      }),
    ]);

    const bMap = new Map<string, number>();
    const patrimonyMap = new Map<string, number>();
    let totalPatrimonyValue = 0;
    for (const b of buildings) {
      bMap.set(b.societyId, (bMap.get(b.societyId) ?? 0) + 1);
      const baseCost = (b.acquisitionPrice ?? 0) + (b.acquisitionFees ?? 0) + (b.acquisitionTaxes ?? 0) + (b.acquisitionOtherCosts ?? 0) + (b.worksCost ?? 0);
      const additionalCost = (b.additionalAcquisitions ?? []).reduce(
        (s: number, a: { acquisitionPrice: number | null; acquisitionFees: number | null; acquisitionTaxes: number | null; otherCosts: number | null }) =>
          s + (a.acquisitionPrice ?? 0) + (a.acquisitionFees ?? 0) + (a.acquisitionTaxes ?? 0) + (a.otherCosts ?? 0),
        0,
      );
      const buildingTotalCost = baseCost + additionalCost;
      patrimonyMap.set(b.societyId, (patrimonyMap.get(b.societyId) ?? 0) + buildingTotalCost);
      totalPatrimonyValue += buildingTotalCost;
    }
    const lMap = new Map<string, { total: number; occupied: number }>();
    for (const l of lots) {
      const sid = l.building.societyId;
      const prev = lMap.get(sid) ?? { total: 0, occupied: 0 };
      lMap.set(sid, {
        total: prev.total + 1,
        occupied: l.status === "OCCUPE" ? prev.occupied + 1 : prev.occupied,
      });
    }
    const leaseMap = new Map(activeLeases.map((l) => [l.societyId, l._count.id]));
    const revMap = new Map(monthRevAgg.map((r) => [r.societyId, r._sum.totalTTC ?? 0]));
    const overdueMap = new Map(overdueInvoices.map((o) => [o.societyId, o._sum.totalTTC ?? 0]));
    const rentMap = new Map(rentAgg.map((r) => [r.societyId, r._sum.currentRentHT ?? 0]));

    const cashMap = new Map<string, number>();
    for (const ba of bankAccounts) {
      cashMap.set(ba.societyId, (cashMap.get(ba.societyId) ?? 0) + Number(ba.currentBalance));
    }

    const debtMap = new Map<string, number>();
    const loanPayMap = new Map<string, number>();
    const initialCapitalMap = new Map<string, number>();
    for (const loan of loans) {
      initialCapitalMap.set(loan.societyId, (initialCapitalMap.get(loan.societyId) ?? 0) + Number(loan.amount));
      const line = loan.amortizationLines[0];
      if (line) {
        debtMap.set(loan.societyId, (debtMap.get(loan.societyId) ?? 0) + Number(line.remainingBalance));
        loanPayMap.set(loan.societyId, (loanPayMap.get(loan.societyId) ?? 0) + Number(line.totalPayment));
      }
    }

    // Amortissement capital : mois courant + YTD, agrégé par société
    const principalMonthMap = new Map<string, number>();
    const principalYtdMap = new Map<string, number>();
    for (const line of amortizationLines ?? []) {
      const sid = line.loan.societyId;
      const raw = Number(line.principalPayment);
      const amount = Number.isFinite(raw) ? raw : 0;
      principalYtdMap.set(sid, (principalYtdMap.get(sid) ?? 0) + amount);
      // La borne haute (dueDate <= now) est déjà appliquée par la requête ;
      // on ne garde donc ici que la comparaison au début du mois courant.
      if (line.dueDate >= monthStart) {
        principalMonthMap.set(sid, (principalMonthMap.get(sid) ?? 0) + amount);
      }
    }

    const buckets = { lt30: 0, lt60: 0, lt90: 0, gt90: 0 };
    for (const inv of allOverdue) {
      const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const amt = Number(inv.totalTTC);
      if (days < 30) buckets.lt30 += amt;
      else if (days < 60) buckets.lt60 += amt;
      else if (days < 90) buckets.lt90 += amt;
      else buckets.gt90 += amt;
    }
    const overdueByAge: OverdueAgeBucket[] = [
      { label: "< 30 jours", amount: buckets.lt30 },
      { label: "30-60 jours", amount: buckets.lt60 },
      { label: "60-90 jours", amount: buckets.lt90 },
      { label: "> 90 jours", amount: buckets.gt90 },
    ];

    const socNameMap = new Map(ownedSocieties.map((s) => [s.id, s.name]));
    const expiringLeases: ExpiringLease[] = expiringLeasesRaw.map((l) => ({
      id: l.id,
      societyName: socNameMap.get(l.societyId) ?? "",
      tenantName: l.tenant.entityType === "PERSONNE_MORALE"
        ? (l.tenant.companyName ?? "—")
        : `${l.tenant.firstName ?? ""} ${l.tenant.lastName ?? ""}`.trim() || "—",
      lotLabel: l.lot ? `${l.lot.building.name} – Lot ${l.lot.number}` : "—",
      endDate: l.endDate.toISOString(),
      daysLeft: Math.max(0, Math.floor((l.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
    }));

    const societies: OwnerSocietySummary[] = ownedSocieties.map((s) => ({
      id: s.id,
      name: s.name,
      legalForm: s.legalForm,
      city: s.city,
      logoUrl: s.logoUrl,
      buildings: bMap.get(s.id) ?? 0,
      lots: lMap.get(s.id)?.total ?? 0,
      occupiedLots: lMap.get(s.id)?.occupied ?? 0,
      currentMonthRevenue: Number(revMap.get(s.id) ?? 0),
      overdueAmount: Number(overdueMap.get(s.id) ?? 0),
      activeLeases: leaseMap.get(s.id) ?? 0,
      cashBalance: cashMap.get(s.id) ?? 0,
      initialLoanCapital: initialCapitalMap.get(s.id) ?? 0,
      totalDebt: debtMap.get(s.id) ?? 0,
      monthlyLoanPayment: loanPayMap.get(s.id) ?? 0,
      principalAmortizedMonth: principalMonthMap.get(s.id) ?? 0,
      principalAmortizedYTD: principalYtdMap.get(s.id) ?? 0,
      monthlyRentHT: Number(rentMap.get(s.id) ?? 0),
      patrimonyValue: patrimonyMap.get(s.id) ?? 0,
      ltv: (() => {
        const debt = debtMap.get(s.id) ?? 0;
        const patri = patrimonyMap.get(s.id) ?? 0;
        return patri > 0 ? Math.round((debt / patri) * 1000) / 10 : null;
      })(),
    }));

    const rawLenderNames = loans.map((l) => l.lender || "Autre");
    const lenderNameMapping = buildLenderMapping(rawLenderNames);
    const lenderMap = new Map<string, { loanCount: number; totalCapital: number; remainingBalance: number; monthlyPayment: number }>();
    for (const loan of loans) {
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

    const totalLots = societies.reduce((s, x) => s + x.lots, 0);
    const totalOccupied = societies.reduce((s, x) => s + x.occupiedLots, 0);
    const annualRevenue = societies.reduce((s, x) => s + x.currentMonthRevenue, 0) * 12;

    return {
      totalSocieties: ownedSocieties.length,
      totalBuildings: societies.reduce((s, x) => s + x.buildings, 0),
      totalLots,
      totalOccupied,
      totalMonthRevenue: societies.reduce((s, x) => s + x.currentMonthRevenue, 0),
      totalOverdue: societies.reduce((s, x) => s + x.overdueAmount, 0),
      totalActiveLeases: societies.reduce((s, x) => s + x.activeLeases, 0),
      totalCash: societies.reduce((s, x) => s + x.cashBalance, 0),
      totalInitialLoanCapital: societies.reduce((s, x) => s + x.initialLoanCapital, 0),
      totalDebt: societies.reduce((s, x) => s + x.totalDebt, 0),
      totalMonthlyLoanPayment: societies.reduce((s, x) => s + x.monthlyLoanPayment, 0),
      totalPrincipalAmortizedMonth: societies.reduce((s, x) => s + x.principalAmortizedMonth, 0),
      totalPrincipalAmortizedYTD: societies.reduce((s, x) => s + x.principalAmortizedYTD, 0),
      totalMonthlyRentHT: societies.reduce((s, x) => s + x.monthlyRentHT, 0),
      totalRecoverableCharges: chargeAgg.reduce((sum, c) => sum + Number(c.amount ?? 0), 0),
      totalPatrimonyValue,
      grossYield: totalPatrimonyValue > 0 ? Math.round((annualRevenue / totalPatrimonyValue) * 1000) / 10 : null,
      consolidatedLTV: totalPatrimonyValue > 0
        ? Math.round((societies.reduce((s, x) => s + x.totalDebt, 0) / totalPatrimonyValue) * 1000) / 10
        : null,
      occupancyRate: totalLots > 0 ? Math.round((totalOccupied / totalLots) * 100) : 0,
      overdueByAge,
      expiringLeases,
      societies,
      lenderSummaries,
    };
  },
  // v2 : ajout initialLoanCapital + principalAmortizedMonth/YTD aux sociétés et totaux
  ["owner-analytics-data-v3"],
  { revalidate: 60 },
);

export async function getOwnerAnalytics(proprietaireId?: string): Promise<ActionResult<OwnerAnalytics>> {
  try {
    const context = await requireAuthenticatedActionContext();
    const data = await _fetchOwnerAnalyticsData(context.userId, proprietaireId ?? null);
    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    console.error("[getOwnerAnalytics]", error);
    return { success: false, error: "Erreur lors du chargement des analytics propriétaire" };
  }
}

export async function isOwnerOfSociety(userId: string, societyId: string): Promise<boolean> {
  const society = await prisma.society.findFirst({
    where: { id: societyId, ownerId: userId },
    select: { id: true },
  });
  return !!society;
}

export async function getClaimableSocieties(): Promise<ActionResult<{ id: string; name: string; legalForm: string; siret: string | null; city: string }[]>> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return { success: false, error: "Non authentifie" };

  const memberships = await prisma.userSociety.findMany({
    where: {
      userId: context.userId,
      role: { in: ["ADMIN_SOCIETE", "SUPER_ADMIN"] },
      society: { ownerId: null },
    },
    select: {
      society: {
        select: { id: true, name: true, legalForm: true, siret: true, city: true },
      },
    },
  });

  return { success: true, data: memberships.map((m) => m.society) };
}

export async function claimSociety(societyId: string, proprietaireId?: string): Promise<ActionResult<void>> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return { success: false, error: "Non authentifie" };

  const membership = await prisma.userSociety.findUnique({
    where: { userId_societyId: { userId: context.userId, societyId } },
    select: { role: true },
  });

  if (!membership || !["ADMIN_SOCIETE", "SUPER_ADMIN"].includes(membership.role)) {
    return { success: false, error: "Vous devez etre administrateur de cette societe pour la rattacher" };
  }

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { ownerId: true, name: true },
  });

  if (!society) return { success: false, error: "Societe introuvable" };
  if (society.ownerId) return { success: false, error: "Cette societe a deja un proprietaire" };

  if (proprietaireId) {
    const prop = await prisma.proprietaire.findFirst({
      where: { id: proprietaireId, userId: context.userId },
      select: { id: true },
    });
    if (!prop) return { success: false, error: "Propriétaire introuvable" };
  }

  await prisma.society.update({
    where: { id: societyId },
    data: {
      ownerId: context.userId,
      ...(proprietaireId ? { proprietaireId } : {}),
    },
  });

  revalidatePath("/proprietaire");
  return { success: true };
}

export type OwnerProfileInput = {
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: string;
  birthPlace?: string;
  address?: string;
  postalCode?: string;
  ownerCity?: string;
  profession?: string;
  nationality?: string;
  company?: string;
  emailCopyEnabled?: boolean;
  emailCopyAddress?: string;
};

export async function getOwnerProfile(): Promise<ActionResult<{
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  address: string | null;
  postalCode: string | null;
  ownerCity: string | null;
  profession: string | null;
  nationality: string | null;
  company: string | null;
  email: string;
  emailCopyEnabled: boolean;
  emailCopyAddress: string | null;
}>> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return { success: false, error: "Non authentifie" };

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      birthDate: true,
      birthPlace: true,
      address: true,
      postalCode: true,
      ownerCity: true,
      profession: true,
      nationality: true,
      company: true,
      emailCopyEnabled: true,
      emailCopyAddress: true,
    },
  });

  if (!user) return { success: false, error: "Utilisateur introuvable" };
  return { success: true, data: user };
}

// ── Consolidated data for proprietaire tabs ──

export type ConsolidatedBuilding = {
  id: string;
  name: string;
  city: string;
  buildingType: string;
  totalArea: number;
  totalLots: number;
  occupiedLots: number;
  annualRent: number;
  totalCost: number;
  venalValue: number | null;
  yieldRate: number | null;
  societyName: string;
  societyId: string;
};

export type ConsolidatedLease = {
  id: string;
  lotLabel: string;
  buildingName: string;
  buildingCity: string;
  tenantName: string;
  status: string;
  leaseType: string;
  destination: string | null;
  startDate: Date;
  endDate: Date | null;
  currentRentHT: number;
  paymentFrequency: string;
  indexType: string | null;
  lastRevisionDate: Date | null;
  societyName: string;
  societyId: string;
};

export type ConsolidatedLoan = {
  id: string;
  label: string;
  lender: string;
  loanType: string;
  status: string;
  amount: number;
  interestRate: number;
  insuranceRate: number | null;
  durationMonths: number;
  startDate: Date;
  endDate: Date | null;
  remainingBalance: number;
  currentPeriod: number;
  monthlyPayment: number;
  buildingName: string | null;
  buildingCity: string | null;
  societyName: string;
  societyId: string;
};

const FREQ_MULT: Record<string, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };

async function getOwnerSocietyIds(userId: string, proprietaireId?: string): Promise<string[]> {
  const where = proprietaireId
    ? { proprietaireId, proprietaire: { userId } }
    : { ownerId: userId };
  const societies = await prisma.society.findMany({
    where,
    select: { id: true },
  });
  return societies.map((s) => s.id);
}

const _fetchConsolidatedBuildingsData = unstable_cache(
  async (userId: string, proprietaireId: string | null): Promise<ConsolidatedBuilding[]> => {
    const ids = await getOwnerSocietyIds(userId, proprietaireId ?? undefined);
    if (ids.length === 0) return [];

    const buildings = await prisma.building.findMany({
      where: { societyId: { in: ids } },
      include: {
        society: { select: { id: true, name: true } },
        lots: {
          select: {
            status: true,
            area: true,
            leases: {
              where: { status: "EN_COURS" },
              select: { currentRentHT: true, paymentFrequency: true },
              take: 1,
            },
          },
        },
        propertyValuations: {
          where: { status: "COMPLETED" },
          select: { estimatedValueMid: true },
          orderBy: { valuationDate: "desc" },
          take: 1,
        },
        additionalAcquisitions: {
          select: { acquisitionPrice: true, acquisitionFees: true, acquisitionTaxes: true, otherCosts: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return buildings.map((b) => {
      const occupied = b.lots.filter((l) => l.status === "OCCUPE").length;
      const annualRent = b.lots.reduce((s, lot) => {
        const lease = lot.leases[0];
        if (!lease) return s;
        return s + lease.currentRentHT * (FREQ_MULT[lease.paymentFrequency] ?? 12);
      }, 0);
      const baseCost = (b.acquisitionPrice ?? 0) + (b.acquisitionFees ?? 0) + (b.acquisitionTaxes ?? 0) + (b.acquisitionOtherCosts ?? 0) + (b.worksCost ?? 0);
      const additionalCost = (b.additionalAcquisitions ?? []).reduce((s, a) => s + (a.acquisitionPrice ?? 0) + (a.acquisitionFees ?? 0) + (a.acquisitionTaxes ?? 0) + (a.otherCosts ?? 0), 0);
      const totalCost = baseCost + additionalCost;
      const venalValue = b.propertyValuations?.[0]?.estimatedValueMid ?? null;
      const yieldRate = totalCost > 0 && annualRent > 0 ? Math.round((annualRent / totalCost) * 1000) / 10 : null;
      const totalArea = b.totalArea ?? b.lots.reduce((s, l) => s + (l.area ?? 0), 0);

      return {
        id: b.id,
        name: b.name,
        city: b.city,
        buildingType: b.buildingType,
        totalArea,
        totalLots: b.lots.length,
        occupiedLots: occupied,
        annualRent,
        totalCost,
        venalValue,
        yieldRate,
        societyName: b.society.name,
        societyId: b.society.id,
      };
    });
  },
  ["owner-consolidated-buildings"],
  { revalidate: 120 },
);

export async function getConsolidatedBuildings(proprietaireId?: string): Promise<ActionResult<ConsolidatedBuilding[]>> {
  try {
    const context = await requireAuthenticatedActionContext();
    const data = await _fetchConsolidatedBuildingsData(context.userId, proprietaireId ?? null);
    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    console.error("[getConsolidatedBuildings]", error);
    return { success: false, error: "Erreur lors du chargement des immeubles consolidés" };
  }
}

const _fetchConsolidatedLeasesData = unstable_cache(
  async (userId: string, proprietaireId: string | null): Promise<ConsolidatedLease[]> => {
    const ids = await getOwnerSocietyIds(userId, proprietaireId ?? undefined);
    if (ids.length === 0) return [];

    const leases = await prisma.lease.findMany({
      where: { societyId: { in: ids } },
      include: {
        society: { select: { id: true, name: true } },
        lot: {
          select: {
            number: true,
            building: { select: { name: true, postalCode: true, city: true } },
          },
        },
        tenant: {
          select: { entityType: true, companyName: true, firstName: true, lastName: true },
        },
        rentRevisions: {
          where: { isValidated: true },
          orderBy: { effectiveDate: "desc" },
          take: 1,
          select: { effectiveDate: true },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });

    return leases.map((l) => ({
      id: l.id,
      lotLabel: `Lot ${l.lot.number}`,
      buildingName: l.lot.building.name,
      buildingCity: `${l.lot.building.postalCode} ${l.lot.building.city}`,
      tenantName: l.tenant.entityType === "PERSONNE_MORALE"
        ? (l.tenant.companyName ?? "—")
        : `${l.tenant.firstName ?? ""} ${l.tenant.lastName ?? ""}`.trim() || "—",
      status: l.status,
      leaseType: l.leaseType,
      destination: l.destination,
      startDate: l.startDate,
      endDate: l.endDate,
      currentRentHT: l.currentRentHT,
      paymentFrequency: l.paymentFrequency,
      indexType: l.indexType,
      lastRevisionDate: l.rentRevisions?.[0]?.effectiveDate ?? null,
      societyName: l.society.name,
      societyId: l.society.id,
    }));
  },
  ["owner-consolidated-leases"],
  { revalidate: 120 },
);

export async function getConsolidatedLeases(proprietaireId?: string): Promise<ActionResult<ConsolidatedLease[]>> {
  try {
    const context = await requireAuthenticatedActionContext();
    const data = await _fetchConsolidatedLeasesData(context.userId, proprietaireId ?? null);
    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    console.error("[getConsolidatedLeases]", error);
    return { success: false, error: "Erreur lors du chargement des baux consolidés" };
  }
}

const _fetchConsolidatedLoansData = unstable_cache(
  async (userId: string, proprietaireId: string | null): Promise<ConsolidatedLoan[]> => {
    const ids = await getOwnerSocietyIds(userId, proprietaireId ?? undefined);
    if (ids.length === 0) return [];

    const loans = await prisma.loan.findMany({
      where: { societyId: { in: ids } },
      include: {
        society: { select: { id: true, name: true } },
        building: { select: { name: true, city: true } },
        amortizationLines: {
          where: { isPaid: true },
          orderBy: { period: "desc" },
          take: 1,
          select: { remainingBalance: true, period: true, totalPayment: true },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });

    return loans.map((l) => {
      const lastLine = l.amortizationLines[0];
      return {
        id: l.id,
        label: l.label,
        lender: l.lender || "Autre",
        loanType: l.loanType,
        status: l.status,
        amount: l.amount,
        interestRate: l.interestRate,
        insuranceRate: l.insuranceRate,
        durationMonths: l.durationMonths,
        startDate: l.startDate,
        endDate: l.endDate,
        remainingBalance: lastLine?.remainingBalance ?? l.amount,
        currentPeriod: lastLine?.period ?? 0,
        monthlyPayment: lastLine?.totalPayment ?? 0,
        buildingName: l.building?.name ?? null,
        buildingCity: l.building?.city ?? null,
        societyName: l.society.name,
        societyId: l.society.id,
      };
    });
  },
  ["owner-consolidated-loans"],
  { revalidate: 120 },
);

export async function getConsolidatedLoans(proprietaireId?: string): Promise<ActionResult<ConsolidatedLoan[]>> {
  try {
    const context = await requireAuthenticatedActionContext();
    const data = await _fetchConsolidatedLoansData(context.userId, proprietaireId ?? null);
    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    console.error("[getConsolidatedLoans]", error);
    return { success: false, error: "Erreur lors du chargement des emprunts consolidés" };
  }
}

export async function updateOwnerProfile(input: OwnerProfileInput): Promise<ActionResult<void>> {
  const context = await getOptionalAuthenticatedActionContext();
  if (!context) return { success: false, error: "Non authentifie" };

  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    return { success: false, error: "Le prenom et le nom sont obligatoires" };
  }

  await prisma.user.update({
    where: { id: context.userId },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      name: `${input.firstName.trim()} ${input.lastName.trim()}`,
      phone: input.phone?.trim() || null,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      birthPlace: input.birthPlace?.trim() || null,
      address: input.address?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      ownerCity: input.ownerCity?.trim() || null,
      profession: input.profession?.trim() || null,
      nationality: input.nationality?.trim() || null,
      company: input.company?.trim() || null,
      ...(input.emailCopyEnabled !== undefined ? { emailCopyEnabled: input.emailCopyEnabled } : {}),
      ...(input.emailCopyAddress !== undefined ? { emailCopyAddress: input.emailCopyAddress?.trim() || null } : {}),
    },
  });

  revalidatePath("/proprietaire");
  revalidatePath("/", "layout");
  return { success: true };
}
