"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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
  totalDebt: number;
  monthlyLoanPayment: number;
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
  totalDebt: number;
  totalMonthlyLoanPayment: number;
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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  // Si proprietaireId fourni, filtrer par proprietaire (en vérifiant qu'il appartient à l'user)
  const where = proprietaireId
    ? { proprietaireId, proprietaire: { userId: session.user.id } }
    : { ownerId: session.user.id };

  const societies = await prisma.society.findMany({
    where,
    select: { id: true, name: true, legalForm: true, siret: true, city: true, isActive: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  return { success: true, data: societies };
}

export async function getOwnerAnalytics(proprietaireId?: string): Promise<ActionResult<OwnerAnalytics>> {
  try {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  // Filtrer par proprietaire si fourni, sinon toutes les sociétés de l'user
  const where = proprietaireId
    ? { proprietaireId, proprietaire: { userId: session.user.id } }
    : { ownerId: session.user.id };

  const ownedSocieties = await prisma.society.findMany({
    where,
    select: { id: true, name: true, legalForm: true, city: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  if (ownedSocieties.length === 0) {
    return {
      success: true,
      data: {
        totalSocieties: 0, totalBuildings: 0, totalLots: 0, totalOccupied: 0,
        totalMonthRevenue: 0, totalOverdue: 0, totalActiveLeases: 0,
        totalCash: 0, totalDebt: 0, totalMonthlyLoanPayment: 0,
        totalMonthlyRentHT: 0, totalRecoverableCharges: 0,
        totalPatrimonyValue: 0,
        grossYield: null, consolidatedLTV: null, occupancyRate: 0,
        overdueByAge: [], expiringLeases: [], societies: [],
        lenderSummaries: [],
      },
    };
  }

  const ids = ownedSocieties.map((s) => s.id);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    buildings, lots, activeLeases, monthRevAgg, overdueInvoices,
    bankAccounts, loans, allOverdue, expiringLeasesRaw, rentAgg, chargeAgg,
  ] = await Promise.all([
    prisma.building.findMany({
      where: { societyId: { in: ids } },
      select: { societyId: true },
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
      where: { societyId: { in: ids }, invoiceType: { not: "AVOIR" }, issueDate: { gte: monthStart } },
      _sum: { totalTTC: true },
    }),
    prisma.invoice.groupBy({
      by: ["societyId"],
      where: {
        societyId: { in: ids },
        status: { in: ["EN_ATTENTE", "PARTIELLEMENT_PAYE", "EN_RETARD"] },
        dueDate: { lt: now },
      },
      _sum: { totalTTC: true },
    }),
    // Trésorerie
    prisma.bankAccount.findMany({
      where: { societyId: { in: ids }, isActive: true },
      select: { societyId: true, currentBalance: true },
    }),
    // Emprunts actifs avec dernière ligne d'amortissement
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
    // Tous les impayés pour ventilation par ancienneté
    prisma.invoice.findMany({
      where: {
        societyId: { in: ids },
        status: { in: ["EN_ATTENTE", "PARTIELLEMENT_PAYE", "EN_RETARD"] },
        dueDate: { lt: now },
      },
      select: { dueDate: true, totalTTC: true },
    }),
    // Baux expirant dans 90 jours
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
    // Loyers mensuels HT
    prisma.lease.groupBy({
      by: ["societyId"],
      where: { societyId: { in: ids }, status: "EN_COURS" },
      _sum: { currentRentHT: true },
    }),
    // Charges récupérables (12 derniers mois) — findMany car aggregate ne supporte pas les filtres relationnels
    prisma.charge.findMany({
      where: {
        societyId: { in: ids },
        date: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
        category: { nature: { in: ["RECUPERABLE", "MIXTE"] } },
      },
      select: { amount: true },
    }),
  ]);

  // Maps par société
  const bMap = new Map<string, number>();
  for (const b of buildings) {
    bMap.set(b.societyId, (bMap.get(b.societyId) ?? 0) + 1);
  }
  // Patrimoine = somme des valeurs d'acquisition (purchaseValue, fallback sur amount)
  let totalPatrimonyValue = 0;
  for (const loan of loans) {
    totalPatrimonyValue += Number(loan.purchaseValue ?? loan.amount ?? 0);
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

  // Trésorerie par société
  const cashMap = new Map<string, number>();
  for (const ba of bankAccounts) {
    cashMap.set(ba.societyId, (cashMap.get(ba.societyId) ?? 0) + Number(ba.currentBalance));
  }

  // Dette et patrimoine par société
  const debtMap = new Map<string, number>();
  const loanPayMap = new Map<string, number>();
  const patrimonyMap = new Map<string, number>();
  for (const loan of loans) {
    patrimonyMap.set(loan.societyId, (patrimonyMap.get(loan.societyId) ?? 0) + Number(loan.purchaseValue ?? loan.amount ?? 0));
    const line = loan.amortizationLines[0];
    if (line) {
      debtMap.set(loan.societyId, (debtMap.get(loan.societyId) ?? 0) + Number(line.remainingBalance));
      loanPayMap.set(loan.societyId, (loanPayMap.get(loan.societyId) ?? 0) + Number(line.totalPayment));
    }
  }

  // Impayés par ancienneté
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

  // Baux expirant
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
    totalDebt: debtMap.get(s.id) ?? 0,
    monthlyLoanPayment: loanPayMap.get(s.id) ?? 0,
    monthlyRentHT: Number(rentMap.get(s.id) ?? 0),
    patrimonyValue: patrimonyMap.get(s.id) ?? 0,
    ltv: (() => {
      const debt = debtMap.get(s.id) ?? 0;
      const patri = patrimonyMap.get(s.id) ?? 0;
      return patri > 0 ? Math.round((debt / patri) * 1000) / 10 : null;
    })(),
  }));

  // Encours par établissement prêteur (consolidé toutes sociétés)
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
    success: true,
    data: {
      totalSocieties: ownedSocieties.length,
      totalBuildings: societies.reduce((s, x) => s + x.buildings, 0),
      totalLots,
      totalOccupied,
      totalMonthRevenue: societies.reduce((s, x) => s + x.currentMonthRevenue, 0),
      totalOverdue: societies.reduce((s, x) => s + x.overdueAmount, 0),
      totalActiveLeases: societies.reduce((s, x) => s + x.activeLeases, 0),
      totalCash: societies.reduce((s, x) => s + x.cashBalance, 0),
      totalDebt: societies.reduce((s, x) => s + x.totalDebt, 0),
      totalMonthlyLoanPayment: societies.reduce((s, x) => s + x.monthlyLoanPayment, 0),
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
    },
  };
  } catch (error) {
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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  // Societes ou l utilisateur est admin mais n est pas encore proprietaire
  const memberships = await prisma.userSociety.findMany({
    where: {
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  // Verifier que l utilisateur est ADMIN_SOCIETE ou plus
  const membership = await prisma.userSociety.findUnique({
    where: { userId_societyId: { userId: session.user.id, societyId } },
    select: { role: true },
  });

  if (!membership || !["ADMIN_SOCIETE", "SUPER_ADMIN"].includes(membership.role)) {
    return { success: false, error: "Vous devez etre administrateur de cette societe pour la rattacher" };
  }

  // Verifier que la societe n a pas deja de proprietaire
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { ownerId: true, name: true },
  });

  if (!society) return { success: false, error: "Societe introuvable" };
  if (society.ownerId) return { success: false, error: "Cette societe a deja un proprietaire" };

  // Si proprietaireId fourni, vérifier qu'il appartient à l'user
  if (proprietaireId) {
    const prop = await prisma.proprietaire.findFirst({
      where: { id: proprietaireId, userId: session.user.id },
      select: { id: true },
    });
    if (!prop) return { success: false, error: "Propriétaire introuvable" };
  }

  await prisma.society.update({
    where: { id: societyId },
    data: {
      ownerId: session.user.id,
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
  email: string;
  emailCopyEnabled: boolean;
  emailCopyAddress: string | null;
}>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
      emailCopyEnabled: true,
      emailCopyAddress: true,
    },
  });

  if (!user) return { success: false, error: "Utilisateur introuvable" };
  return { success: true, data: user };
}

export async function updateOwnerProfile(input: OwnerProfileInput): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    return { success: false, error: "Le prenom et le nom sont obligatoires" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
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
      ...(input.emailCopyEnabled !== undefined ? { emailCopyEnabled: input.emailCopyEnabled } : {}),
      ...(input.emailCopyAddress !== undefined ? { emailCopyAddress: input.emailCopyAddress?.trim() || null } : {}),
    },
  });

  revalidatePath("/proprietaire");
  revalidatePath("/", "layout");
  return { success: true };
}
