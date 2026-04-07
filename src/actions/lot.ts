"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive, checkLotLimit } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createLotSchema,
  updateLotSchema,
  type CreateLotInput,
  type UpdateLotInput,
} from "@/validations/lot";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { Prisma } from "@/generated/prisma/client";

export interface LotFilters {
  status?: string;
  lotType?: string;
  buildingId?: string;
  exploitationStatus?: string;
}

export async function getFilteredLots(societyId: string, filters: LotFilters = {}) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  const where: Prisma.LotWhereInput = { building: { societyId } };

  if (filters.status) {
    where.status = filters.status as Prisma.LotWhereInput["status"];
  }
  if (filters.lotType) {
    where.lotType = filters.lotType as Prisma.LotWhereInput["lotType"];
  }
  if (filters.buildingId) {
    where.buildingId = filters.buildingId;
  }
  if (filters.exploitationStatus) {
    where.exploitationStatus = filters.exploitationStatus as Prisma.LotWhereInput["exploitationStatus"];
  }

  return prisma.lot.findMany({
    where,
    include: {
      building: { select: { id: true, name: true, city: true } },
      leases: {
        where: { status: "EN_COURS" },
        select: { currentRentHT: true, paymentFrequency: true },
        take: 1,
      },
      _count: { select: { leases: true } },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
  });
}

export async function createLot(
  societyId: string,
  input: CreateLotInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // Vérifier abonnement actif et limite de lots
    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };
    const lotCheck = await checkLotLimit(societyId);
    if (!lotCheck.allowed) return { success: false, error: lotCheck.message };

    const parsed = createLotSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier que l'immeuble appartient à la société
    const building = await prisma.building.findFirst({
      where: { id: data.buildingId, societyId },
    });
    if (!building) {
      return { success: false, error: "Immeuble introuvable" };
    }

    // Vérifier l'unicité du numéro de lot dans l'immeuble
    const existing = await prisma.lot.findFirst({
      where: { buildingId: data.buildingId, number: data.number },
    });
    if (existing) {
      return {
        success: false,
        error: `Le numéro de lot "${data.number}" existe déjà dans cet immeuble`,
      };
    }

    const lot = await prisma.lot.create({
      data: {
        buildingId: data.buildingId,
        number: data.number,
        lotType: data.lotType,
        area: data.area,
        commonShares: data.commonShares ?? 0,
        floor: data.floor ?? null,
        position: data.position ?? null,
        description: data.description ?? null,
        status: data.status,
        marketRentValue: data.marketRentValue ?? null,
        currentRent: data.currentRent ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Lot",
      entityId: lot.id,
      details: { number: lot.number, buildingId: lot.buildingId },
    });

    revalidatePath(`/patrimoine/immeubles/${data.buildingId}`);
    revalidatePath("/patrimoine/lots");

    return { success: true, data: { id: lot.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[createLot]", error);
    return { success: false, error: "Erreur lors de la création du lot" };
  }
}

export async function updateLot(
  societyId: string,
  input: UpdateLotInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateLotSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, buildingId, ...data } = parsed.data;

    // Vérifier que le lot appartient à la société
    const lot = await prisma.lot.findFirst({
      where: { id, building: { societyId } },
    });
    if (!lot) {
      return { success: false, error: "Lot introuvable" };
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      updateData[key] = value === "" ? null : value;
    }

    await prisma.lot.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Lot",
      entityId: id!,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath(`/patrimoine/immeubles/${lot.buildingId}`);
    revalidatePath(`/patrimoine/immeubles/${lot.buildingId}/lots/${id}`);
    revalidatePath("/patrimoine/lots");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateLot]", error);
    return { success: false, error: "Erreur lors de la mise à jour du lot" };
  }
}

export async function deleteLot(
  societyId: string,
  lotId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const lot = await prisma.lot.findFirst({
      where: { id: lotId, building: { societyId } },
      include: { _count: { select: { leases: true } } },
    });
    if (!lot) return { success: false, error: "Lot introuvable" };

    if (lot._count.leases > 0) {
      return {
        success: false,
        error: `Impossible de supprimer : ${lot._count.leases} bail(aux) associé(s) à ce lot. Supprimez les baux d'abord.`,
      };
    }

    await prisma.lot.delete({ where: { id: lotId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Lot",
      entityId: lotId,
      details: { number: lot.number, buildingId: lot.buildingId },
    });

    revalidatePath(`/patrimoine/immeubles/${lot.buildingId}`);
    revalidatePath("/patrimoine/immeubles");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteLot]", error);
    return { success: false, error: "Erreur lors de la suppression du lot" };
  }
}

export async function getLots(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.lot.findMany({
    where: { building: { societyId } },
    include: {
      building: { select: { id: true, name: true, city: true } },
      leases: {
        where: { status: "EN_COURS" },
        select: { currentRentHT: true, paymentFrequency: true },
        take: 1,
      },
      _count: { select: { leases: true } },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
  });
}

export async function getLotById(societyId: string, lotId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.lot.findFirst({
    where: { id: lotId, building: { societyId } },
    include: {
      building: { select: { id: true, name: true, city: true, postalCode: true } },
      leases: {
        where: { status: "EN_COURS" },
        include: {
          tenant: {
            select: {
              id: true,
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      _count: { select: { leases: true } },
    },
  });
}
