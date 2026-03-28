"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";

export type DashboardAlert = {
  id: string;
  type: "danger" | "warning" | "info";
  title: string;
  message: string;
  link: string;
  date: string;
  category: string;
  count?: number;
};

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

/**
 * Indicateurs de performance par immeuble.
 */
export async function getBuildingPerformance(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  const buildings = await prisma.building.findMany({
    where: { societyId },
    include: {
      lots: {
        select: {
          id: true,
          status: true,
          area: true,
          currentRent: true,
          marketRentValue: true,
          leases: {
            where: { status: "EN_COURS" },
            select: {
              id: true,
              currentRentHT: true,
              startDate: true,
              endDate: true,
              invoices: {
                where: { status: { in: ["PAYE", "PARTIELLEMENT_PAYE"] } },
                select: { totalTTC: true },
              },
            },
          },
        },
      },
    },
  });

  return buildings.map((building) => {
    const totalLots = building.lots.length;
    const occupiedLots = building.lots.filter((l) => l.status === "OCCUPE").length;
    const vacantLots = building.lots.filter((l) => l.status === "VACANT").length;
    const totalArea = building.lots.reduce((s, l) => s + l.area, 0);
    const occupiedArea = building.lots
      .filter((l) => l.status === "OCCUPE")
      .reduce((s, l) => s + l.area, 0);

    const monthlyRent = building.lots.reduce((s, l) => {
      const activeLease = l.leases[0];
      return s + (activeLease?.currentRentHT ?? 0);
    }, 0);
    const annualRevenue = monthlyRent * 12;

    const collectedRevenue = building.lots.reduce((s, l) => {
      return s + l.leases.reduce((ls, lease) => {
        return ls + lease.invoices.reduce((is, inv) => is + inv.totalTTC, 0);
      }, 0);
    }, 0);

    const marketValue = building.lots.reduce((s, l) => s + (l.marketRentValue ?? l.currentRent ?? 0), 0) * 12;
    const vacancyRate = totalLots > 0 ? (vacantLots / totalLots) * 100 : 0;
    const grossYield = marketValue > 0 ? (annualRevenue / marketValue) * 100 : 0;
    const occupancyRateArea = totalArea > 0 ? (occupiedArea / totalArea) * 100 : 0;

    return {
      id: building.id,
      name: building.name,
      city: building.city,
      totalLots,
      occupiedLots,
      vacantLots,
      totalArea: Math.round(totalArea * 100) / 100,
      occupiedArea: Math.round(occupiedArea * 100) / 100,
      vacancyRate: Math.round(vacancyRate * 10) / 10,
      occupancyRateArea: Math.round(occupancyRateArea * 10) / 10,
      monthlyRent: Math.round(monthlyRent * 100) / 100,
      annualRevenue: Math.round(annualRevenue * 100) / 100,
      collectedRevenue: Math.round(collectedRevenue * 100) / 100,
      grossYield: Math.round(grossYield * 10) / 10,
    };
  });
}

function displayTenantName(t: { entityType: string; companyName: string | null; firstName: string | null; lastName: string | null }): string {
  if (t.entityType === "PERSONNE_MORALE") return t.companyName ?? "—";
  return ((t.firstName ?? "") + " " + (t.lastName ?? "")).trim() || "—";
}

/**
 * Alertes en temps reel pour le dashboard.
 * Chaque alerte a un id, type, title, message, link, date, category, count.
 */
export async function getDashboardAlerts(societyId: string): Promise<DashboardAlert[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  const now = new Date();
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);
  const in6Months = new Date(now);
  in6Months.setMonth(in6Months.getMonth() + 6);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const alerts: DashboardAlert[] = [];
  const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR");
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  // ---- 1. Baux expirant dans 90 jours ----
  const expiringLeases = await prisma.lease.findMany({
    where: {
      societyId,
      status: "EN_COURS",
      endDate: { gte: now, lte: in90Days },
    },
    select: {
      id: true,
      endDate: true,
      tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
      lot: { select: { number: true, building: { select: { name: true } } } },
    },
    orderBy: { endDate: "asc" },
  });
  for (const lease of expiringLeases) {
    const tenantName = displayTenantName(lease.tenant);
    alerts.push({
      id: `lease-expiring-${lease.id}`,
      type: "warning",
      category: "Baux",
      title: "Bail expirant bientot",
      message: `${tenantName} - ${lease.lot.building.name} Lot ${lease.lot.number} - Fin le ${fmtDate(new Date(lease.endDate))}`,
      link: `/baux/${lease.id}`,
      date: new Date(lease.endDate).toISOString(),
    });
  }

  // ---- 2. Factures impayees > 30 jours ----
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      societyId,
      invoiceType: { not: "AVOIR" },
      OR: [
        { status: "EN_RETARD" },
        { status: "RELANCEE" },
        { status: "EN_ATTENTE", dueDate: { lt: thirtyDaysAgo } },
        { status: "PARTIELLEMENT_PAYE", dueDate: { lt: thirtyDaysAgo } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalTTC: true,
      dueDate: true,
      tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  });
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((s, inv) => s + inv.totalTTC, 0);
    alerts.push({
      id: "invoices-overdue-30d",
      type: "danger",
      category: "Facturation",
      title: `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} impayee${overdueInvoices.length > 1 ? "s" : ""} > 30 jours`,
      message: `Montant total : ${fmtCurrency(totalOverdue)}`,
      link: "/facturation?status=EN_RETARD",
      date: now.toISOString(),
      count: overdueInvoices.length,
    });
    for (const inv of overdueInvoices.slice(0, 5)) {
      const tenantName = displayTenantName(inv.tenant);
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      alerts.push({
        id: `invoice-overdue-${inv.id}`,
        type: "danger",
        category: "Facturation",
        title: `Facture ${inv.invoiceNumber} impayee`,
        message: `${tenantName} - ${fmtCurrency(inv.totalTTC)} - ${daysOverdue} jours de retard`,
        link: `/facturation/${inv.id}`,
        date: new Date(inv.dueDate).toISOString(),
      });
    }
  }

  // ---- 3. Diagnostics expirant dans 6 mois ----
  const expiringDiagnostics = await prisma.diagnostic.findMany({
    where: {
      building: { societyId },
      expiresAt: { not: null, gte: now, lte: in6Months },
    },
    select: {
      id: true,
      type: true,
      expiresAt: true,
      building: { select: { id: true, name: true } },
    },
    orderBy: { expiresAt: "asc" },
  });
  for (const diag of expiringDiagnostics) {
    const daysLeft = Math.ceil((new Date(diag.expiresAt!).getTime() - now.getTime()) / 86400000);
    const isUrgent = daysLeft <= 60;
    alerts.push({
      id: `diagnostic-expiring-${diag.id}`,
      type: isUrgent ? "danger" : "warning",
      category: "Diagnostics",
      title: `Diagnostic ${diag.type} a renouveler`,
      message: `${diag.building.name} - Expire le ${fmtDate(new Date(diag.expiresAt!))} (${daysLeft} jours)`,
      link: `/patrimoine/immeubles/${diag.building.id}/diagnostics`,
      date: new Date(diag.expiresAt!).toISOString(),
    });
  }

  // ---- 4. Revisions de loyer en attente ----
  const pendingRevisions = await prisma.rentRevision.findMany({
    where: {
      isValidated: false,
      lease: { societyId, status: "EN_COURS" },
    },
    select: {
      id: true,
      effectiveDate: true,
      previousRentHT: true,
      newRentHT: true,
      lease: {
        select: {
          id: true,
          tenant: { select: { entityType: true, companyName: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { effectiveDate: "asc" },
  });
  if (pendingRevisions.length > 0) {
    alerts.push({
      id: "rent-revisions-pending",
      type: "warning",
      category: "Revisions",
      title: `${pendingRevisions.length} revision${pendingRevisions.length > 1 ? "s" : ""} de loyer en attente`,
      message: "Des revisions de loyer doivent etre validees",
      link: "/baux",
      date: now.toISOString(),
      count: pendingRevisions.length,
    });
  }

  // ---- 5. Loyers en retard (par locataire) ----
  const tenantsWithLatePayments = await prisma.invoice.groupBy({
    by: ["tenantId"],
    where: {
      societyId,
      status: { in: ["EN_RETARD", "RELANCEE"] },
      invoiceType: { not: "AVOIR" },
    },
    _sum: { totalTTC: true },
    _count: true,
  });
  if (tenantsWithLatePayments.length > 0) {
    const tenantIds = tenantsWithLatePayments.map((t) => t.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, entityType: true, companyName: true, firstName: true, lastName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    for (const group of tenantsWithLatePayments.slice(0, 5)) {
      const tenant = tenantMap.get(group.tenantId);
      if (!tenant) continue;
      const tenantName = displayTenantName(tenant);
      alerts.push({
        id: `tenant-late-${group.tenantId}`,
        type: "danger",
        category: "Loyers",
        title: `Loyers en retard - ${tenantName}`,
        message: `${group._count} facture${group._count > 1 ? "s" : ""} - ${fmtCurrency(group._sum.totalTTC ?? 0)}`,
        link: `/locataires/${group.tenantId}`,
        date: now.toISOString(),
        count: group._count,
      });
    }
  }

  // ---- 6. Factures brouillon a valider ----
  const draftCount = await prisma.invoice.count({
    where: { societyId, status: "BROUILLON" },
  });
  if (draftCount > 0) {
    alerts.push({
      id: "invoices-draft",
      type: "info",
      category: "Facturation",
      title: `${draftCount} brouillon${draftCount > 1 ? "s" : ""} a valider`,
      message: "Des factures sont en attente de validation",
      link: "/facturation?status=BROUILLON",
      date: now.toISOString(),
      count: draftCount,
    });
  }

  // ---- 7. Lots vacants ----
  const vacantLots = await prisma.lot.count({
    where: {
      status: "VACANT",
      building: { societyId },
    },
  });
  if (vacantLots > 0) {
    alerts.push({
      id: "lots-vacant",
      type: "warning",
      category: "Patrimoine",
      title: `${vacantLots} lot${vacantLots > 1 ? "s" : ""} vacant${vacantLots > 1 ? "s" : ""}`,
      message: "Des lots sont actuellement sans locataire",
      link: "/patrimoine/lots",
      date: now.toISOString(),
      count: vacantLots,
    });
  }

  // ---- 8. Factures litigieuses ----
  const litigiousCount = await prisma.invoice.count({
    where: { societyId, status: "LITIGIEUX" },
  });
  if (litigiousCount > 0) {
    alerts.push({
      id: "invoices-litigious",
      type: "danger",
      category: "Contentieux",
      title: `${litigiousCount} facture${litigiousCount > 1 ? "s" : ""} en contentieux`,
      message: "Des factures sont en situation de litige",
      link: "/facturation?status=LITIGIEUX",
      date: now.toISOString(),
      count: litigiousCount,
    });
  }

  // Tri : danger en premier, puis warning, puis info
  return alerts.sort((a, b) => {
    const priority = { danger: 0, warning: 1, info: 2 };
    return priority[a.type] - priority[b.type];
  });
}
