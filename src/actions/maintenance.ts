"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  type CreateMaintenanceInput,
  type UpdateMaintenanceInput,
} from "@/validations/maintenance";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

export async function createMaintenance(
  societyId: string,
  input: CreateMaintenanceInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createMaintenanceSchema.safeParse(input);
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

    const maintenance = await prisma.maintenance.create({
      data: {
        buildingId: data.buildingId,
        lotId: data.lotId ?? null,
        title: data.title,
        description: data.description ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
        cost: data.cost ?? null,
        isPaid: data.isPaid,
        notes: data.notes ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Maintenance",
      entityId: maintenance.id,
      details: { title: maintenance.title, buildingId: maintenance.buildingId },
    });

    revalidatePath(`/patrimoine/immeubles/${data.buildingId}`);

    return { success: true, data: { id: maintenance.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[createMaintenance]", error);
    return { success: false, error: "Erreur lors de la création de l'intervention" };
  }
}

export async function updateMaintenance(
  societyId: string,
  input: UpdateMaintenanceInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateMaintenanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, buildingId, ...data } = parsed.data;

    const existing = await prisma.maintenance.findFirst({
      where: { id, building: { societyId } },
    });
    if (!existing) {
      return { success: false, error: "Intervention introuvable" };
    }

    await prisma.maintenance.update({
      where: { id },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Maintenance",
      entityId: id!,
    });

    revalidatePath(`/patrimoine/immeubles/${existing.buildingId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateMaintenance]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteMaintenance(
  societyId: string,
  maintenanceId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.maintenance.findFirst({
      where: { id: maintenanceId, building: { societyId } },
    });
    if (!existing) {
      return { success: false, error: "Intervention introuvable" };
    }

    await prisma.maintenance.delete({ where: { id: maintenanceId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Maintenance",
      entityId: maintenanceId,
    });

    revalidatePath(`/patrimoine/immeubles/${existing.buildingId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deleteMaintenance]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
