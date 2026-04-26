"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  getOptionalSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createLegalEventSchema,
  updateLegalEventSchema,
  type CreateLegalEventInput,
  type UpdateLegalEventInput,
} from "@/validations/legal-event";

export async function createLegalEvent(
  societyId: string,
  input: CreateLegalEventInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createLegalEventSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    // Vérifier que le bail appartient à la société
    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    const eventDate = new Date(parsed.data.eventDate);
    if (isNaN(eventDate.getTime())) return { success: false, error: "Date d'événement invalide" };

    const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (dueDate && isNaN(dueDate.getTime())) return { success: false, error: "Date d'échéance invalide" };

    const event = await prisma.legalEvent.create({
      data: {
        societyId,
        leaseId: parsed.data.leaseId,
        type: parsed.data.type,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        eventDate,
        dueDate,
        status: parsed.data.status ?? "OUVERT",
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LegalEvent",
      entityId: event.id,
      details: { leaseId: parsed.data.leaseId, type: parsed.data.type, title: parsed.data.title },
    });

    revalidatePath(`/baux/${parsed.data.leaseId}`);
    return { success: true, data: { id: event.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createLegalEvent]", error);
    return { success: false, error: "Erreur lors de la création de l'événement juridique" };
  }
}

export async function updateLegalEvent(
  societyId: string,
  input: UpdateLegalEventInput
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateLegalEventSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.legalEvent.findFirst({ where: { id, societyId } });
    if (!existing) return { success: false, error: "Événement introuvable" };

    const updateData: Record<string, unknown> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.eventDate !== undefined) {
      const d = new Date(data.eventDate);
      if (isNaN(d.getTime())) return { success: false, error: "Date d'événement invalide" };
      updateData.eventDate = d;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "RESOLU" || data.status === "CLASSE") {
        updateData.resolvedAt = new Date();
      }
    }
    if (data.resolvedNote !== undefined) updateData.resolvedNote = data.resolvedNote?.trim() || null;

    await prisma.legalEvent.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LegalEvent",
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
    });

    revalidatePath(`/baux/${existing.leaseId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateLegalEvent]", error);
    return { success: false, error: "Erreur lors de la mise à jour de l'événement juridique" };
  }
}

export async function deleteLegalEvent(
  societyId: string,
  eventId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const existing = await prisma.legalEvent.findFirst({ where: { id: eventId, societyId } });
    if (!existing) return { success: false, error: "Événement introuvable" };

    await prisma.legalEvent.delete({ where: { id: eventId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "LegalEvent",
      entityId: eventId,
      details: { leaseId: existing.leaseId, type: existing.type },
    });

    revalidatePath(`/baux/${existing.leaseId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteLegalEvent]", error);
    return { success: false, error: "Erreur lors de la suppression de l'événement juridique" };
  }
}

export async function getLegalEventsByLease(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.legalEvent.findMany({
    where: { societyId, leaseId },
    orderBy: { eventDate: "desc" },
  });
}

export async function getLegalEventsBySociety(
  societyId: string,
  opts: { status?: string; type?: string } = {}
) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.legalEvent.findMany({
    where: {
      societyId,
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.type ? { type: opts.type as never } : {}),
    },
    include: {
      lease: {
        select: {
          id: true,
          leaseNumber: true,
          tenant: { select: { firstName: true, lastName: true, companyName: true, entityType: true } },
          lot: { select: { number: true, building: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ eventDate: "desc" }],
    take: 200,
  });
}
