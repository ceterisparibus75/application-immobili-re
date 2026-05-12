"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  inclusiveDays,
  dateOnlyIso,
  roundMoney,
  chargeAmountForPeriod,
  provisionAmountForPeriod,
  recoverableRateFor,
  allocationRateForCategory,
} from "@/actions/charge-shared";

export async function getChargeCategories(societyId: string, buildingId?: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.chargeCategory.findMany({
    where: {
      societyId,
      ...(buildingId ? { buildingId } : {}),
    },
    include: {
      building: { select: { id: true, name: true } },
      _count: { select: { charges: true } },
    },
    orderBy: [{ building: { name: "asc" } }, { name: "asc" }],
  });
}

// ─── Charges (dépenses) ───────────────────────────────────────────────────────


export async function getChargesPaginated(
  societyId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    filters?: Record<string, string>;
  } = {}
) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return { data: [], total: 0 };

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { societyId };

  if (params.search) {
    const q = params.search;
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { supplierName: { contains: q, mode: "insensitive" } },
      { category: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (params.filters?.buildingId) where.buildingId = params.filters.buildingId;
  if (params.filters?.isPaid === "true") where.isPaid = true;
  else if (params.filters?.isPaid === "false") where.isPaid = false;
  if (params.filters?.nature) where.category = { nature: params.filters.nature };

  type OrderBy = Record<string, "asc" | "desc">;
  let orderBy: OrderBy[] = [{ date: "desc" }];
  if (params.sortBy) {
    orderBy = [{ [params.sortBy]: params.sortOrder ?? "asc" }];
  }

  const [data, total] = await Promise.all([
    prisma.charge.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, nature: true, recoverableRate: true } },
        building: { select: { id: true, name: true, city: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.charge.count({ where }),
  ]);

  return { data, total };
}

export async function getCharges(societyId: string, buildingId?: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.charge.findMany({
    where: {
      societyId,
      ...(buildingId ? { buildingId } : {}),
    },
    include: {
      category: { select: { id: true, name: true, nature: true, recoverableRate: true } },
      building: { select: { id: true, name: true, city: true } },
    },
    orderBy: [{ date: "desc" }],
  });
}

export async function getChargeById(societyId: string, chargeId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.charge.findFirst({
    where: { id: chargeId, societyId },
    include: {
      category: true,
      building: { select: { id: true, name: true, city: true } },
    },
  });
}

// ============ BDD SOCIÉTÉ ============

export async function getSocietyChargeCategories(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];
  return prisma.societyChargeCategory.findMany({
    where: {
      OR: [
        { societyId },
        { societyId: null, isGlobal: true },
      ],
      isActive: true,
    },
    orderBy: [{ isGlobal: "desc" }, { name: "asc" }],
  });
}


export async function getChargeRegularizations(societyId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];
  return prisma.chargeRegularization.findMany({
    where: { societyId },
    include: {
      lease: {
        include: {
          tenant: { select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true, email: true } },
          lot: { include: { building: { select: { id: true, name: true, city: true } } } },
        },
      },
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ fiscalYear: "desc" }, { createdAt: "desc" }],
  });
}

export async function generateAnnualChargeReport(
  societyId: string,
  buildingId: string,
  year: number
): Promise<ActionResult<{ created: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const periodStart = new Date(year, 0, 1);
    const periodEnd = new Date(year, 11, 31, 23, 59, 59);

    // 1. Charges de l'immeuble sur la période
    const charges = await prisma.charge.findMany({
      where: {
        societyId,
        buildingId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      include: {
        category: {
          include: {
            allocationKeys: {
              include: { entries: { select: { lotId: true, percentage: true } } },
            },
          },
        },
      },
    });

    if (charges.length === 0) {
      return { success: false, error: "Aucune charge trouvée pour cet immeuble sur cette période" };
    }

    const categoriesWithoutExplicitKey = [
      ...new Set(
        charges
          .filter((charge) => {
            const method = charge.category.allocationMethod;
            const keys = charge.category.allocationKeys ?? [];
            return charge.category.nature !== "PROPRIETAIRE" && (method === "COMPTEUR" || method === "PERSONNALISE") && keys.length === 0;
          })
          .map((charge) => charge.category.name)
      ),
    ];

    if (categoriesWithoutExplicitKey.length > 0) {
      return {
        success: false,
        error: `Clé de répartition requise pour : ${categoriesWithoutExplicitKey.join(", ")}`,
      };
    }

    // 2. Lots de l'immeuble
    const buildingLots = await prisma.lot.findMany({
      where: { buildingId },
      select: { id: true },
    });
    const buildingLotIds = buildingLots.map((l) => l.id);

    // 3. Baux actifs sur la période
    const allLeases = await prisma.lease.findMany({
      where: {
        societyId,
        lotId: { in: buildingLotIds },
        startDate: { lte: periodEnd },
        status: { in: ["EN_COURS", "RESILIE", "RENOUVELE"] },
      },
      include: {
        lot: true,
        tenant: { select: { id: true, firstName: true, lastName: true, companyName: true, entityType: true, email: true } },
        chargeProvisions: { where: { isActive: true } },
      },
    });
    // Filtrer les baux qui couvrent la période (endDate null = bail encore actif)
    const leases = allLeases.filter(
      (l) => l.endDate == null || l.endDate >= periodStart
    );

    if (leases.length === 0) {
      return { success: false, error: "Aucun bail actif sur cet immeuble pour cette période" };
    }

    // 4. Total tantiemes / surface pour répartition
    const totalTantiemes = leases.reduce((s, l) => s + (l.lot.commonShares ?? 0), 0);
    const totalSurface = leases.reduce((s, l) => s + l.lot.area, 0);
    const nbLots = leases.length;

    // 5. Pour chaque bail, calculer la part
    let created = 0;
    for (const lease of leases) {
      // Proratisation si bail ne couvre pas toute l'année
      const leaseStart = lease.startDate > periodStart ? lease.startDate : periodStart;
      const leaseEndRaw = lease.endDate ?? periodEnd;
      const leaseEnd = leaseEndRaw < periodEnd ? leaseEndRaw : periodEnd;
      const leaseDays = inclusiveDays(leaseStart, leaseEnd);

      // Calcul des charges récupérables par catégorie
      const categoryDetails: Array<{
        categoryName: string;
        nature: string;
        totalAmount: number;
        recoverableAmount: number;
        allocationMethod: string;
        allocationRate: number;
        tenantShare: number;
      }> = [];

      let totalTenantShare = 0;

      // Grouper les charges par catégorie
      const chargesByCategory = charges.reduce((acc, c) => {
        const key = c.categoryId;
        if (!acc[key]) acc[key] = { category: c.category, charges: [] };
        acc[key]!.charges.push(c);
        return acc;
      }, {} as Record<string, { category: typeof charges[0]["category"]; charges: typeof charges }>);

      for (const { category, charges: catCharges } of Object.values(chargesByCategory)) {
        if (category.nature === "PROPRIETAIRE") continue;

        const totalAmount = catCharges.reduce((s, c) => s + chargeAmountForPeriod(c, periodStart, periodEnd), 0);
        const recoverableRate = recoverableRateFor(category.nature, category.recoverableRate);
        const recoverableAmount = totalAmount * recoverableRate;

        const allocationRate = allocationRateForCategory(category, lease, { totalTantiemes, totalSurface, nbLots });

        const occupiedAmount = catCharges.reduce((s, c) => s + chargeAmountForPeriod(c, leaseStart, leaseEnd), 0);
        const tenantShare = occupiedAmount * recoverableRate * allocationRate;
        totalTenantShare += tenantShare;

        categoryDetails.push({
          categoryName: category.name,
          nature: category.nature,
          totalAmount,
          recoverableAmount,
          allocationMethod: category.allocationMethod,
          allocationRate: Math.round(allocationRate * 10000) / 100,
          tenantShare: Math.round(tenantShare * 100) / 100,
        });
      }

      // 5. Total provisions versées
      const totalProvisions = lease.chargeProvisions.reduce((s, p) => {
        return s + provisionAmountForPeriod(p, leaseStart, leaseEnd);
      }, 0);

      const balance = totalTenantShare - totalProvisions;

      const tenantName = lease.tenant.entityType === "PERSONNE_MORALE"
        ? (lease.tenant.companyName ?? "Locataire")
        : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim();

      // 6. Créer/mettre à jour ChargeRegularization
      await prisma.chargeRegularization.upsert({
        where: { leaseId_fiscalYear: { leaseId: lease.id, fiscalYear: year } },
        update: {
          societyId,
          periodStart,
          periodEnd,
          totalCharges: roundMoney(totalTenantShare),
          totalProvisions: roundMoney(totalProvisions),
          balance: roundMoney(balance),
          details: {
            tenantName,
            lotNumber: lease.lot.number,
            buildingId,
            prorataDays: leaseDays,
            occupancyStart: dateOnlyIso(leaseStart),
            occupancyEnd: dateOnlyIso(leaseEnd),
            categories: categoryDetails,
            totalRecoverableAllocated: roundMoney(totalTenantShare),
          },
          isFinalized: false,
        },
        create: {
          societyId,
          leaseId: lease.id,
          fiscalYear: year,
          periodStart,
          periodEnd,
          totalCharges: roundMoney(totalTenantShare),
          totalProvisions: roundMoney(totalProvisions),
          balance: roundMoney(balance),
          details: {
            tenantName,
            lotNumber: lease.lot.number,
            buildingId,
            prorataDays: leaseDays,
            occupancyStart: dateOnlyIso(leaseStart),
            occupancyEnd: dateOnlyIso(leaseEnd),
            categories: categoryDetails,
            totalRecoverableAllocated: roundMoney(totalTenantShare),
          },
          isFinalized: false,
        },
      });
      created++;
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "ChargeRegularization",
      entityId: buildingId,
      details: { buildingId, year, count: created },
    });

    revalidatePath("/charges/comptes-rendus");
    return { success: true, data: { created } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[generateAnnualChargeReport]", error);
    return { success: false, error: "Erreur lors de la génération : " + (error instanceof Error ? error.message : String(error)) };
  }
}

