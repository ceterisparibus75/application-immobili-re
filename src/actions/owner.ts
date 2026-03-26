"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

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
};

export type OwnerAnalytics = {
  totalSocieties: number;
  totalBuildings: number;
  totalLots: number;
  totalOccupied: number;
  totalMonthRevenue: number;
  totalOverdue: number;
  totalActiveLeases: number;
  societies: OwnerSocietySummary[];
};

export async function getOwnerSocieties(): Promise<ActionResult<{ id: string; name: string; legalForm: string; siret: string; city: string; isActive: boolean; logoUrl: string | null }[]>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  const societies = await prisma.society.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, name: true, legalForm: true, siret: true, city: true, isActive: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  return { success: true, data: societies };
}

export async function getOwnerAnalytics(): Promise<ActionResult<OwnerAnalytics>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifie" };

  const ownedSocieties = await prisma.society.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, name: true, legalForm: true, city: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  if (ownedSocieties.length === 0) {
    return {
      success: true,
      data: {
        totalSocieties: 0,
        totalBuildings: 0,
        totalLots: 0,
        totalOccupied: 0,
        totalMonthRevenue: 0,
        totalOverdue: 0,
        totalActiveLeases: 0,
        societies: [],
      },
    };
  }

  const ids = ownedSocieties.map((s) => s.id);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [buildings, lots, activeLeases, monthRevAgg, overdueInvoices] = await Promise.all([
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
        status: { in: ["EN_ATTENTE", "PARTIELLEMENT_PAYE"] },
        dueDate: { lt: now },
      },
      _sum: { totalTTC: true },
    }),
  ]);

  const bMap = new Map<string, number>();
  for (const b of buildings) bMap.set(b.societyId, (bMap.get(b.societyId) ?? 0) + 1);
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
  }));

  return {
    success: true,
    data: {
      totalSocieties: ownedSocieties.length,
      totalBuildings: societies.reduce((s, x) => s + x.buildings, 0),
      totalLots: societies.reduce((s, x) => s + x.lots, 0),
      totalOccupied: societies.reduce((s, x) => s + x.occupiedLots, 0),
      totalMonthRevenue: societies.reduce((s, x) => s + x.currentMonthRevenue, 0),
      totalOverdue: societies.reduce((s, x) => s + x.overdueAmount, 0),
      totalActiveLeases: societies.reduce((s, x) => s + x.activeLeases, 0),
      societies,
    },
  };
}

export async function isOwnerOfSociety(userId: string, societyId: string): Promise<boolean> {
  const society = await prisma.society.findFirst({
    where: { id: societyId, ownerId: userId },
    select: { id: true },
  });
  return !!society;
}

export async function getClaimableSocieties(): Promise<ActionResult<{ id: string; name: string; legalForm: string; siret: string; city: string }[]>> {
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

export async function claimSociety(societyId: string): Promise<ActionResult<void>> {
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

  await prisma.society.update({
    where: { id: societyId },
    data: { ownerId: session.user.id },
  });

  revalidatePath("/proprietaire");
  return { success: true };
}
