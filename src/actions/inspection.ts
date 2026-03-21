"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createInspectionSchema,
  updateInspectionSchema,
  type CreateInspectionInput,
  type UpdateInspectionInput,
} from "@/validations/inspection";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

export async function createInspection(
  societyId: string,
  input: CreateInspectionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createInspectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    const inspection = await prisma.inspection.create({
      data: {
        leaseId: parsed.data.leaseId,
        type: parsed.data.type,
        performedAt: new Date(parsed.data.performedAt),
        performedBy: parsed.data.performedBy ?? null,
        generalNotes: parsed.data.generalNotes ?? null,
        rooms: {
          create: parsed.data.rooms.map((room) => ({
            name: room.name,
            condition: room.condition,
            notes: room.notes ?? null,
          })),
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Inspection",
      entityId: inspection.id,
      details: { leaseId: parsed.data.leaseId, type: parsed.data.type },
    });

    revalidatePath(`/baux/${parsed.data.leaseId}`);

    return { success: true, data: { id: inspection.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createInspection]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateInspection(
  societyId: string,
  input: UpdateInspectionInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateInspectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.inspection.findFirst({
      where: { id, lease: { societyId } },
    });
    if (!existing) return { success: false, error: "Inspection introuvable" };

    await prisma.inspection.update({ where: { id }, data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Inspection",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath(`/baux/${existing.leaseId}`);
    revalidatePath(`/baux/${existing.leaseId}/inspections/${id}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateInspection]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function getInspectionsByLease(societyId: string, leaseId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.inspection.findMany({
    where: { leaseId, lease: { societyId } },
    include: {
      rooms: { orderBy: { name: "asc" } },
    },
    orderBy: { performedAt: "desc" },
  });
}

export async function getInspectionById(societyId: string, inspectionId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.inspection.findFirst({
    where: { id: inspectionId, lease: { societyId } },
    include: {
      rooms: {
        include: { photos: true },
        orderBy: { name: "asc" },
      },
      lease: {
        select: {
          id: true,
          tenant: {
            select: {
              id: true,
              entityType: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
          lot: {
            select: {
              number: true,
              building: { select: { name: true, city: true } },
            },
          },
        },
      },
    },
  });
}
