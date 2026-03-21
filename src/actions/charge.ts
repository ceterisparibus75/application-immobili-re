"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createChargeCategorySchema,
  updateChargeCategorySchema,
  createChargeSchema,
  updateChargeSchema,
  type CreateChargeCategoryInput,
  type UpdateChargeCategoryInput,
  type CreateChargeInput,
  type UpdateChargeInput,
} from "@/validations/charge";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

// ─── Catégories de charges ────────────────────────────────────────────────────

export async function createChargeCategory(
  societyId: string,
  input: CreateChargeCategoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

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
      userId: session.user.id,
      action: "CREATE",
      entity: "ChargeCategory",
      entityId: category.id,
      details: { name: parsed.data.name, buildingId: parsed.data.buildingId },
    });

    revalidatePath("/charges");
    revalidatePath(`/patrimoine/immeubles/${parsed.data.buildingId}`);

    return { success: true, data: { id: category.id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

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
      userId: session.user.id,
      action: "UPDATE",
      entity: "ChargeCategory",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateChargeCategory]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function getChargeCategories(societyId: string, buildingId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

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
      userId: session.user.id,
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

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
      userId: session.user.id,
      action: "UPDATE",
      entity: "Charge",
      entityId: id,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.charge.findFirst({
      where: { id: chargeId, societyId },
    });
    if (!existing) return { success: false, error: "Charge introuvable" };

    await prisma.charge.delete({ where: { id: chargeId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Charge",
      entityId: chargeId,
      details: { buildingId: existing.buildingId, amount: existing.amount },
    });

    revalidatePath("/charges");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteCharge]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function getCharges(societyId: string, buildingId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.charge.findMany({
    where: {
      societyId,
      ...(buildingId ? { buildingId } : {}),
    },
    include: {
      category: { select: { id: true, name: true, nature: true } },
      building: { select: { id: true, name: true, city: true } },
    },
    orderBy: [{ date: "desc" }],
  });
}

export async function getChargeById(societyId: string, chargeId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.charge.findFirst({
    where: { id: chargeId, societyId },
    include: {
      category: true,
      building: { select: { id: true, name: true, city: true } },
    },
  });
}
