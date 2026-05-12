"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
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
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  chargeAmountForPeriod,
  provisionAmountForPeriod,
  recoverableRateFor,
  allocationRateForCategory,
  roundMoney,
  inclusiveDays,
  inclusiveMonths,
  dateOnlyIso,
} from "@/actions/charge-shared";

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
        category: {
          include: {
            allocationKeys: {
              include: { entries: { select: { lotId: true, percentage: true } } },
            },
          },
        },
      },
    });

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
        lot: { select: { id: true, area: true, commonShares: true, number: true } },
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
    const totalSurface = activeLeases.reduce((s, l) => s + l.lot.area, 0);
    const nbLots = activeLeases.length;

    let regularizationCount = 0;
    let totalBalance = 0;

    // 3. Pour chaque bail, calculer la quote-part et le solde
    for (const lease of activeLeases) {
      const lotShares = lease.lot.commonShares ?? 1;
      const shareRatio = totalShares > 0 ? lotShares / totalShares : 0;

      // Quote-part des charges réelles
      let leaseChargeShare = 0;

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

      // Détails par catégorie de charge
      const leaseDays = inclusiveDays(leaseStart, leaseEnd);
      const details = charges.reduce<Record<string, {
        categoryName: string;
        nature: string;
        totalAmount: number;
        recoverableAmount: number;
        allocationMethod: string;
        allocationRate: number;
        tenantShare: number;
      }>>((acc, c) => {
        const key = c.category.name;
        const allocationRate = allocationRateForCategory(c.category, lease, { totalTantiemes: totalShares, totalSurface, nbLots });
        if (!acc[key]) {
          acc[key] = {
            categoryName: key,
            nature: c.category.nature,
            totalAmount: 0,
            recoverableAmount: 0,
            allocationMethod: c.category.allocationMethod,
            allocationRate: roundMoney(allocationRate * 100),
            tenantShare: 0,
          };
        }
        const amount = chargeAmountForPeriod(c, start, end);
        const recoverableAmount = amount * recoverableRateFor(c.category.nature, c.category.recoverableRate);
        const occupiedAmount = chargeAmountForPeriod(c, leaseStart, leaseEnd);
        const allocatedAmount = occupiedAmount * recoverableRateFor(c.category.nature, c.category.recoverableRate) * allocationRate;
        leaseChargeShare += allocatedAmount;
        acc[key].totalAmount += amount;
        acc[key].recoverableAmount += recoverableAmount;
        acc[key].tenantShare += allocatedAmount;
        return acc;
      }, {});

      // Convention ChargeRegularization.balance : positif = complément dû, négatif = avoir locataire.
      const balance = leaseChargeShare - totalProvisions;
      totalBalance += balance;

      await prisma.chargeRegularization.upsert({
        where: { leaseId_fiscalYear: { leaseId: lease.id, fiscalYear } },
        update: {
          periodStart: start,
          periodEnd: end,
          totalCharges: roundMoney(leaseChargeShare),
          totalProvisions: roundMoney(totalProvisions),
          balance: roundMoney(balance),
          details: {
            shareRatio: Math.round(shareRatio * 10000) / 10000,
            lotShares,
            totalShares,
            monthsCovered,
            prorataDays: leaseDays,
            occupancyStart: dateOnlyIso(leaseStart),
            occupancyEnd: dateOnlyIso(leaseEnd),
            categories: Object.values(details).map((detail) => ({
              ...detail,
              totalAmount: roundMoney(detail.totalAmount),
              recoverableAmount: roundMoney(detail.recoverableAmount),
              tenantShare: roundMoney(detail.tenantShare),
            })),
          },
          isFinalized: false,
        },
        create: {
          leaseId: lease.id,
          societyId,
          fiscalYear,
          periodStart: start,
          periodEnd: end,
          totalCharges: roundMoney(leaseChargeShare),
          totalProvisions: roundMoney(totalProvisions),
          balance: roundMoney(balance),
          details: {
            shareRatio: Math.round(shareRatio * 10000) / 10000,
            lotShares,
            totalShares,
            monthsCovered,
            prorataDays: leaseDays,
            occupancyStart: dateOnlyIso(leaseStart),
            occupancyEnd: dateOnlyIso(leaseEnd),
            categories: Object.values(details).map((detail) => ({
              ...detail,
              totalAmount: roundMoney(detail.totalAmount),
              recoverableAmount: roundMoney(detail.recoverableAmount),
              tenantShare: roundMoney(detail.tenantShare),
            })),
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
      details: { fiscalYear, regularizationCount, totalBalance: roundMoney(totalBalance) },
    });

    revalidatePath("/charges");
    return {
      success: true,
      data: {
        regularizations: regularizationCount,
        totalBalance: roundMoney(totalBalance),
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[autoRegularizeCharges]", error);
    return { success: false, error: "Erreur lors de la régularisation" };
  }
}

