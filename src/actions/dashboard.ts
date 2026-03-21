"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";

export async function getDashboardStats(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    buildingCount,
    lotCount,
    vacantLotCount,
    activeLeaseCount,
    tenantCount,
    monthInvoices,
    overdueInvoices,
    expiringLeases,
    expiringDiagnostics,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.building.count({ where: { societyId } }),
    prisma.lot.count({ where: { building: { societyId } } }),
    prisma.lot.count({ where: { building: { societyId }, status: "VACANT" } }),
    prisma.lease.count({ where: { societyId, status: "EN_COURS" } }),
    prisma.tenant.count({ where: { societyId, isActive: true } }),
    prisma.invoice.aggregate({
      where: {
        societyId,
        issueDate: { gte: startOfMonth, lte: endOfMonth },
        invoiceType: { not: "AVOIR" },
      },
      _sum: { totalTTC: true },
      _count: true,
    }),
    prisma.invoice.count({
      where: { societyId, status: "EN_RETARD" },
    }),
    prisma.lease.findMany({
      where: {
        societyId,
        status: "EN_COURS",
        endDate: { lte: in90Days },
      },
      select: {
        id: true,
        endDate: true,
        tenant: {
          select: {
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
        lot: {
          select: {
            number: true,
            building: { select: { name: true } },
          },
        },
      },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
    prisma.diagnostic.findMany({
      where: {
        building: { societyId },
        expiresAt: { not: null, lte: in90Days },
      },
      select: {
        id: true,
        type: true,
        expiresAt: true,
        building: { select: { id: true, name: true } },
      },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { societyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    buildingCount,
    lotCount,
    vacantLotCount,
    activeLeaseCount,
    tenantCount,
    monthRevenueTTC: monthInvoices._sum.totalTTC ?? 0,
    monthInvoiceCount: monthInvoices._count,
    overdueInvoiceCount: overdueInvoices,
    expiringLeases,
    expiringDiagnostics,
    recentAuditLogs,
  };
}
