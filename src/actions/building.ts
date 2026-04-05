"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createBuildingSchema,
  updateBuildingSchema,
  type CreateBuildingInput,
  type UpdateBuildingInput,
} from "@/validations/building";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

export async function createBuilding(
  societyId: string,
  input: CreateBuildingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = createBuildingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    const building = await prisma.building.create({
      data: {
        societyId,
        name: data.name,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        buildingType: data.buildingType,
        yearBuilt: data.yearBuilt ?? null,
        totalArea: data.totalArea ?? null,
        marketValue: data.marketValue ?? null,
        netBookValue: data.netBookValue ?? null,
        acquisitionPrice: data.acquisitionPrice ?? null,
        acquisitionFees: data.acquisitionFees ?? null,
        acquisitionTaxes: data.acquisitionTaxes ?? null,
        acquisitionOtherCosts: data.acquisitionOtherCosts ?? null,
        acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null,
        description: data.description ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Building",
      entityId: building.id,
      details: { name: building.name, city: building.city },
    });

    revalidatePath("/patrimoine/immeubles");
    revalidatePath("/dashboard");

    return { success: true, data: { id: building.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[createBuilding]", error);
    return { success: false, error: "Erreur lors de la création de l'immeuble" };
  }
}

export async function updateBuilding(
  societyId: string,
  input: UpdateBuildingInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateBuildingSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, ...data } = parsed.data;

    // Vérifier que l'immeuble appartient à cette société
    const existing = await prisma.building.findFirst({
      where: { id, societyId },
    });
    if (!existing) {
      return { success: false, error: "Immeuble introuvable" };
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === "" || value === undefined || value === null) {
        updateData[key] = null;
      } else if (key === "acquisitionDate") {
        // Prisma attend un objet Date, pas une chaîne ISO
        updateData[key] = new Date(value as string);
      } else {
        updateData[key] = value;
      }
    }

    await prisma.building.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Building",
      entityId: id!,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath("/patrimoine/immeubles");
    revalidatePath(`/patrimoine/immeubles/${id}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateBuilding]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteBuilding(
  societyId: string,
  buildingId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    // Vérifier l'absence de baux actifs sur les lots de cet immeuble
    const activeLeases = await prisma.lease.count({
      where: {
        societyId,
        lot: { buildingId },
        status: "EN_COURS",
      },
    });
    if (activeLeases > 0) {
      return {
        success: false,
        error: `Impossible de supprimer : ${activeLeases} bail(aux) actif(s) sur cet immeuble`,
      };
    }

    await prisma.building.delete({ where: { id: buildingId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Building",
      entityId: buildingId,
    });

    revalidatePath("/patrimoine/immeubles");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deleteBuilding]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function getBuildings(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.building.findMany({
    where: { societyId },
    include: {
      _count: { select: { lots: true, diagnostics: true, maintenances: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getBuildingById(societyId: string, buildingId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.building.findFirst({
    where: { id: buildingId, societyId },
    include: {
      society: { select: { id: true, name: true, legalForm: true } },
      lots: {
        orderBy: { number: "asc" },
        include: {
          _count: { select: { leases: true } },
          leases: {
            where: { status: "EN_COURS" },
            select: {
              id: true,
              status: true,
              tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
            },
          },
        },
      },
      diagnostics: { orderBy: { expiresAt: "asc" } },
      maintenances: { orderBy: { scheduledAt: "desc" }, take: 10 },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, fileUrl: true, category: true, description: true, createdAt: true, expiresAt: true },
      },
      _count: { select: { lots: true, diagnostics: true, maintenances: true, documents: true } },
    },
  });
}
