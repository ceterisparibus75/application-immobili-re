"use server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";

export type AllocationEntry = {
  lotId: string;
  percentage: number;
};

export type SetAllocationKeyInput = {
  categoryId: string;
  entries: AllocationEntry[];
};

export type AllocationKeyData = {
  id: string | null;
  categoryId: string;
  entries: Array<{
    lotId: string;
    lotNumber: string;
    lotArea: number;
    percentage: number;
  }>;
};

export async function setAllocationKey(
  societyId: string,
  input: SetAllocationKeyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const category = await prisma.chargeCategory.findFirst({
      where: { id: input.categoryId, societyId },
    });
    if (!category) return { success: false, error: "Categorie introuvable" };

    const total = input.entries.reduce((s, e) => s + e.percentage, 0);
    if (Math.abs(total - 100) > 0.5) {
      return { success: false, error: `La somme des pourcentages doit etre egale a 100 % (actuellement ${total.toFixed(1)} %)` };
    }

    const key = await prisma.$transaction(async (tx) => {
      const existingKey = await tx.allocationKey.findFirst({
        where: { categoryId: input.categoryId },
        select: { id: true },
      });
      const upserted = existingKey
        ? await tx.allocationKey.update({
            where: { id: existingKey.id },
            data: { method: "PERSONNALISE" },
          })
        : await tx.allocationKey.create({
            data: { categoryId: input.categoryId, method: "PERSONNALISE" },
          });

      await tx.allocationKeyEntry.deleteMany({
        where: { allocationKeyId: upserted.id },
      });

      await tx.allocationKeyEntry.createMany({
        data: input.entries.map((e) => ({
          allocationKeyId: upserted.id,
          lotId: e.lotId,
          percentage: e.percentage,
        })),
      });

      return upserted;
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "ChargeCategory",
      entityId: input.categoryId,
      details: {
        event: "SET_ALLOCATION_KEY",
        keyId: key.id,
        entriesCount: input.entries.length,
      },
    });

    revalidatePath("/charges");
    return { success: true, data: { id: key.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[setAllocationKey]", error);
    return { success: false, error: "Erreur lors de l'enregistrement de la cle" };
  }
}

export async function getOrCreateAllocationKey(
  societyId: string,
  categoryId: string
): Promise<ActionResult<AllocationKeyData>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const key = await prisma.allocationKey.findFirst({
      where: { categoryId },
      include: {
        entries: {
          include: { lot: { select: { id: true, number: true, area: true } } },
        },
        category: { select: { buildingId: true } },
      },
    });

    if (key) {
      return {
        success: true,
        data: {
          id: key.id,
          categoryId,
          entries: key.entries.map((e) => ({
            lotId: e.lotId,
            lotNumber: e.lot.number,
            lotArea: e.lot.area,
            percentage: e.percentage,
          })),
        },
      };
    }

    // No key yet — return empty entries from building lots
    const category = await prisma.chargeCategory.findFirst({
      where: { id: categoryId, societyId },
      select: { buildingId: true },
    });

    const lots = await prisma.lot.findMany({
      where: { buildingId: category?.buildingId ?? "" },
      select: { id: true, number: true, area: true },
      orderBy: { number: "asc" },
    });

    return {
      success: true,
      data: {
        id: null,
        categoryId,
        entries: lots.map((l) => ({
          lotId: l.id,
          lotNumber: l.number,
          lotArea: l.area,
          percentage: 0,
        })),
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getOrCreateAllocationKey]", error);
    return { success: false, error: "Erreur lors de la recuperation des cles" };
  }
}

export async function deleteAllocationKey(
  societyId: string,
  categoryId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    await prisma.chargeCategory.findFirst({ where: { id: categoryId, societyId } });

    await prisma.allocationKey.deleteMany({ where: { categoryId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "ChargeCategory",
      entityId: categoryId,
      details: { event: "DELETE_ALLOCATION_KEY" },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteAllocationKey]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
