"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createChargeCategorySchema,
  updateChargeCategorySchema,
  createChargeSchema,
  updateChargeSchema,
  createSocietyChargeCategorySchema,
  updateSocietyChargeCategorySchema,
  type CreateChargeCategoryInput,
  type UpdateChargeCategoryInput,
  type CreateChargeInput,
  type UpdateChargeInput,
  type CreateSocietyChargeCategoryInput,
  type UpdateSocietyChargeCategoryInput,
} from "@/validations/charge";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type ChargePeriodLike = {
  amount: number;
  date: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
};

type ChargeProvisionLike = {
  monthlyAmount: number;
  startDate: Date;
  endDate?: Date | null;
};

type ChargeNatureLike = "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE" | string;

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function inclusiveDays(start: Date, end: Date): number {
  const startTime = dayStart(start).getTime();
  const endTime = dayStart(end).getTime();
  return Math.max(0, Math.floor((endTime - startTime) / MS_PER_DAY) + 1);
}

function overlapDays(startA: Date, endA: Date, startB: Date, endB: Date): number {
  const start = new Date(Math.max(dayStart(startA).getTime(), dayStart(startB).getTime()));
  const end = new Date(Math.min(dayStart(endA).getTime(), dayStart(endB).getTime()));
  return inclusiveDays(start, end);
}

function inclusiveMonths(start: Date, end: Date): number {
  if (dayStart(end) < dayStart(start)) return 0;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
}

function chargeAmountForPeriod(charge: ChargePeriodLike, periodStart: Date, periodEnd: Date): number {
  const chargeStart = charge.periodStart ?? charge.date;
  const chargeEnd = charge.periodEnd ?? charge.date;
  const totalDays = inclusiveDays(chargeStart, chargeEnd);
  if (totalDays === 0) return 0;

  const coveredDays = overlapDays(chargeStart, chargeEnd, periodStart, periodEnd);
  return charge.amount * (coveredDays / totalDays);
}

function provisionAmountForPeriod(provision: ChargeProvisionLike, periodStart: Date, periodEnd: Date): number {
  const start = new Date(Math.max(dayStart(provision.startDate).getTime(), dayStart(periodStart).getTime()));
  const rawEnd = provision.endDate ?? periodEnd;
  const end = new Date(Math.min(dayStart(rawEnd).getTime(), dayStart(periodEnd).getTime()));
  return provision.monthlyAmount * inclusiveMonths(start, end);
}

function recoverableRateFor(nature: ChargeNatureLike, recoverableRate?: number | null): number {
  if (nature === "PROPRIETAIRE") return 0;
  if (nature === "RECUPERABLE") return 1;
  return (recoverableRate ?? 50) / 100;
}

// ─── Catégories de charges ────────────────────────────────────────────────────

export async function createChargeCategory(
  societyId: string,
  input: CreateChargeCategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createChargeCategorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const building = await prisma.building.findFirst({
      where: { id: parsed.data.buildingId, societyId },
    });
    if (!building) return { success: false, error: "Immeuble introuvable" };

    const category = await prisma.chargeCategory.create({
      data: { ...parsed.data, societyId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "ChargeCategory",
      entityId: category.id,
      details: { name: parsed.data.name, buildingId: parsed.data.buildingId },
    });

    revalidatePath("/charges");
    revalidatePath(`/patrimoine/immeubles/${parsed.data.buildingId}`);

    return { success: true, data: { id: category.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createChargeCategory]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateChargeCategory(
  societyId: string,
  input: UpdateChargeCategoryInput
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateChargeCategorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.chargeCategory.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Catégorie introuvable" };

    await prisma.chargeCategory.update({ where: { id }, data });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "ChargeCategory",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateChargeCategory]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

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

export async function createCharge(
  societyId: string,
  input: CreateChargeInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createChargeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const [building, category] = await Promise.all([
      prisma.building.findFirst({ where: { id: parsed.data.buildingId, societyId } }),
      prisma.chargeCategory.findFirst({
        where: { id: parsed.data.categoryId, societyId },
      }),
    ]);

    if (!building) return { success: false, error: "Immeuble introuvable" };
    if (!category) return { success: false, error: "Catégorie introuvable" };

    const charge = await prisma.charge.create({
      data: {
        societyId,
        buildingId: parsed.data.buildingId,
        categoryId: parsed.data.categoryId,
        description: parsed.data.description,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        periodStart: new Date(parsed.data.periodStart),
        periodEnd: new Date(parsed.data.periodEnd),
        supplierName: parsed.data.supplierName ?? null,
        isPaid: parsed.data.isPaid,
        invoiceUrl: parsed.data.invoiceUrl ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Charge",
      entityId: charge.id,
      details: {
        buildingId: parsed.data.buildingId,
        amount: parsed.data.amount,
        description: parsed.data.description,
      },
    });

    revalidatePath("/charges");
    revalidatePath(`/charges/immeubles/${parsed.data.buildingId}`);

    return { success: true, data: { id: charge.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createCharge]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateCharge(
  societyId: string,
  input: UpdateChargeInput
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateChargeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, date, periodStart, periodEnd, ...rest } = parsed.data;

    const existing = await prisma.charge.findFirst({ where: { id, societyId } });
    if (!existing) return { success: false, error: "Charge introuvable" };

    const updateData: Record<string, unknown> = { ...rest };
    if (date) updateData.date = new Date(date);
    if (periodStart) updateData.periodStart = new Date(periodStart);
    if (periodEnd) updateData.periodEnd = new Date(periodEnd);

    await prisma.charge.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Charge",
      entityId: id,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateCharge]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteCharge(
  societyId: string,
  chargeId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const existing = await prisma.charge.findFirst({
      where: { id: chargeId, societyId },
    });
    if (!existing) return { success: false, error: "Charge introuvable" };

    await prisma.charge.delete({ where: { id: chargeId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Charge",
      entityId: chargeId,
      details: { buildingId: existing.buildingId, amount: existing.amount },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteCharge]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

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

export async function createSocietyChargeCategory(
  societyId: string,
  input: CreateSocietyChargeCategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    const parsed = createSocietyChargeCategorySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map(e => e.message).join(", ") };
    const cat = await prisma.societyChargeCategory.create({
      data: { societyId, ...parsed.data },
    });
    await createAuditLog({ societyId, userId: context.userId, action: "CREATE", entity: "SocietyChargeCategory", entityId: cat.id, details: { name: cat.name } });
    revalidatePath("/charges/bibliotheque");
    return { success: true, data: { id: cat.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createSocietyChargeCategory]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateSocietyChargeCategory(
  societyId: string,
  input: UpdateSocietyChargeCategoryInput
): Promise<ActionResult> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    const parsed = updateSocietyChargeCategorySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map(e => e.message).join(", ") };
    const { id, ...data } = parsed.data;
    const existing = await prisma.societyChargeCategory.findUnique({ where: { id } });
    if (existing?.isGlobal) return { success: false, error: "Les catégories standards ne peuvent pas être modifiées" };
    await prisma.societyChargeCategory.update({ where: { id }, data });
    revalidatePath("/charges/bibliotheque");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteSocietyChargeCategory(societyId: string, id: string): Promise<ActionResult> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    const existing = await prisma.societyChargeCategory.findUnique({ where: { id } });
    if (existing?.isGlobal) return { success: false, error: "Les catégories standards ne peuvent pas être supprimées" };
    await prisma.societyChargeCategory.delete({ where: { id } });
    revalidatePath("/charges/bibliotheque");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

// ============ COMPTES RENDUS ANNUELS (CRAC) ============

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

    const totalPeriodCharges = charges.reduce((sum, charge) => {
      return sum + chargeAmountForPeriod(charge, periodStart, periodEnd);
    }, 0);

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
      const totalDaysInYear = inclusiveDays(periodStart, periodEnd);
      const leaseDays = inclusiveDays(leaseStart, leaseEnd);
      const prorata = leaseDays / totalDaysInYear;

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

        // Clé de répartition (PERSONNALISE utilise les entrées stockées)
        let allocationRate = 0;
        if (category.allocationMethod === "PERSONNALISE" && category.allocationKeys.length > 0) {
          const key = category.allocationKeys[0]!;
          const entry = key.entries.find((e) => e.lotId === lease.lotId);
          allocationRate = entry ? entry.percentage / 100 : 0;
        } else if (category.allocationMethod === "SURFACE" && totalSurface > 0) {
          allocationRate = lease.lot.area / totalSurface;
        } else if (category.allocationMethod === "NB_LOTS" && nbLots > 0) {
          allocationRate = 1 / nbLots;
        } else {
          // TANTIEME (default) - fallback sur SURFACE si pas de tantiemes
          if (totalTantiemes > 0 && (lease.lot.commonShares ?? 0) > 0) {
            allocationRate = (lease.lot.commonShares ?? 0) / totalTantiemes;
          } else if (totalSurface > 0) {
            allocationRate = lease.lot.area / totalSurface;
          } else {
            allocationRate = 1 / nbLots;
          }
        }

        const tenantShare = recoverableAmount * allocationRate * prorata;
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
          totalCharges: Math.round(totalPeriodCharges * 100) / 100,
          totalProvisions: Math.round(totalProvisions * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          details: {
            tenantName,
            lotNumber: lease.lot.number,
            buildingId,
            prorataDays: leaseDays,
            categories: categoryDetails,
            totalRecoverableAllocated: Math.round(totalTenantShare * 100) / 100,
          },
          isFinalized: false,
        },
        create: {
          societyId,
          leaseId: lease.id,
          fiscalYear: year,
          periodStart,
          periodEnd,
          totalCharges: Math.round(totalPeriodCharges * 100) / 100,
          totalProvisions: Math.round(totalProvisions * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          details: {
            tenantName,
            lotNumber: lease.lot.number,
            buildingId,
            prorataDays: leaseDays,
            categories: categoryDetails,
            totalRecoverableAllocated: Math.round(totalTenantShare * 100) / 100,
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

export async function finalizeChargeReport(societyId: string, regularizationId: string): Promise<ActionResult> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    await prisma.chargeRegularization.update({
      where: { id: regularizationId },
      data: { isFinalized: true, finalizedAt: new Date() },
    });
    revalidatePath("/charges/comptes-rendus");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    return { success: false, error: "Erreur lors de la finalisation" };
  }
}

// ============ RÉGULARISATION AUTOMATIQUE DES CHARGES ============

/**
 * Régularisation annuelle automatique des charges.
 * Compare les provisions versées aux charges réelles et calcule le solde par bail.
 */
export async function autoRegularizeCharges(
  societyId: string,
  input: {
    buildingId: string;
    fiscalYear: number;
    periodStart: string;
    periodEnd: string;
  }
): Promise<ActionResult<{ regularizations: number; totalBalance: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const { buildingId, fiscalYear, periodStart, periodEnd } = input;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // 1. Total des charges réelles de l'immeuble sur la période
    const charges = await prisma.charge.findMany({
      where: {
        societyId,
        buildingId,
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
      include: {
        category: { select: { nature: true, recoverableRate: true } },
      },
    });

    const totalRealCharges = charges.reduce((sum, c) => {
      const recoverableRate = recoverableRateFor(c.category.nature, c.category.recoverableRate);
      return sum + chargeAmountForPeriod(c, start, end) * recoverableRate;
    }, 0);

    // 2. Baux actifs sur l'immeuble avec leurs lots (pour les tantièmes)
    const activeLeases = await prisma.lease.findMany({
      where: {
        societyId,
        status: { in: ["EN_COURS", "RESILIE"] },
        lot: { buildingId },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        lot: { select: { id: true, commonShares: true, number: true } },
        chargeProvisions: {
          where: { isActive: true },
          select: { monthlyAmount: true, startDate: true, endDate: true },
        },
        tenant: {
          select: { firstName: true, lastName: true, companyName: true, entityType: true },
        },
      },
    });

    // Total des tantièmes de tous les lots actifs
    const totalShares = activeLeases.reduce(
      (s, l) => s + (l.lot.commonShares ?? 1),
      0
    );

    let regularizationCount = 0;
    let totalBalance = 0;

    // 3. Pour chaque bail, calculer la quote-part et le solde
    for (const lease of activeLeases) {
      const lotShares = lease.lot.commonShares ?? 1;
      const shareRatio = totalShares > 0 ? lotShares / totalShares : 0;

      // Quote-part des charges réelles
      const leaseChargeShare = totalRealCharges * shareRatio;

      // Nombre de mois de la période couverte par le bail
      const leaseStart = new Date(Math.max(lease.startDate.getTime(), start.getTime()));
      const leaseEnd = lease.endDate
        ? new Date(Math.min(lease.endDate.getTime(), end.getTime()))
        : end;
      const monthsCovered = inclusiveMonths(leaseStart, leaseEnd);

      // Total des provisions versées
      const totalProvisions = lease.chargeProvisions.reduce((sum, cp) => {
        return sum + provisionAmountForPeriod(cp, leaseStart, leaseEnd);
      }, 0);

      // Convention ChargeRegularization.balance : positif = complément dû, négatif = avoir locataire.
      const balance = leaseChargeShare - totalProvisions;
      totalBalance += balance;

      // Détails par catégorie de charge
      const details = charges.reduce<Record<string, { label: string; amount: number; recoverable: number }>>((acc, c) => {
        const key = c.category.nature;
        if (!acc[key]) acc[key] = { label: key, amount: 0, recoverable: 0 };
        const amount = chargeAmountForPeriod(c, start, end);
        acc[key].amount += amount;
        acc[key].recoverable += amount * recoverableRateFor(c.category.nature, c.category.recoverableRate) * shareRatio;
        return acc;
      }, {});

      await prisma.chargeRegularization.upsert({
        where: { leaseId_fiscalYear: { leaseId: lease.id, fiscalYear } },
        update: {
          periodStart: start,
          periodEnd: end,
          totalCharges: Math.round(leaseChargeShare * 100) / 100,
          totalProvisions: Math.round(totalProvisions * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          details: {
            shareRatio: Math.round(shareRatio * 10000) / 10000,
            lotShares,
            totalShares,
            monthsCovered,
            categories: Object.values(details),
          },
          isFinalized: false,
        },
        create: {
          leaseId: lease.id,
          societyId,
          fiscalYear,
          periodStart: start,
          periodEnd: end,
          totalCharges: Math.round(leaseChargeShare * 100) / 100,
          totalProvisions: Math.round(totalProvisions * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          details: {
            shareRatio: Math.round(shareRatio * 10000) / 10000,
            lotShares,
            totalShares,
            monthsCovered,
            categories: Object.values(details),
          },
        },
      });

      regularizationCount++;
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "ChargeRegularization",
      entityId: buildingId,
      details: { fiscalYear, regularizationCount, totalBalance: Math.round(totalBalance * 100) / 100 },
    });

    revalidatePath("/charges");
    return {
      success: true,
      data: {
        regularizations: regularizationCount,
        totalBalance: Math.round(totalBalance * 100) / 100,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[autoRegularizeCharges]", error);
    return { success: false, error: "Erreur lors de la régularisation" };
  }
}
