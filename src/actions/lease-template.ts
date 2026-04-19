"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createLeaseTemplateSchema,
  updateLeaseTemplateSchema,
  type CreateLeaseTemplateInput,
  type UpdateLeaseTemplateInput,
} from "@/validations/lease-template";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export async function createLeaseTemplate(
  societyId: string,
  input: CreateLeaseTemplateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createLeaseTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const data = parsed.data;

    // Si on marque ce template comme default, retirer le flag des autres du meme type
    if (data.isDefault) {
      await prisma.leaseTemplate.updateMany({
        where: { societyId, leaseType: data.leaseType, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.leaseTemplate.create({
      data: {
        societyId,
        ...data,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LeaseTemplate",
      entityId: template.id,
      details: { name: data.name, leaseType: data.leaseType },
    });

    revalidatePath("/baux/modeles");
    return { success: true, data: { id: template.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createLeaseTemplate]", error);
    return { success: false, error: "Erreur lors de la creation du modele" };
  }
}

export async function updateLeaseTemplate(
  societyId: string,
  input: UpdateLeaseTemplateInput
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateLeaseTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.leaseTemplate.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Modele introuvable" };

    // Si on marque ce template comme default, retirer le flag des autres du meme type
    if (data.isDefault && !existing.isDefault) {
      await prisma.leaseTemplate.updateMany({
        where: {
          societyId,
          leaseType: data.leaseType ?? existing.leaseType,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }

    await prisma.leaseTemplate.update({ where: { id }, data });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LeaseTemplate",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath("/baux/modeles");
    revalidatePath(`/baux/modeles/${id}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateLeaseTemplate]", error);
    return { success: false, error: "Erreur lors de la mise a jour" };
  }
}

export async function deleteLeaseTemplate(
  societyId: string,
  templateId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const template = await prisma.leaseTemplate.findFirst({
      where: { id: templateId, societyId },
      include: { _count: { select: { leases: true } } },
    });
    if (!template) return { success: false, error: "Modele introuvable" };

    if (template._count.leases > 0) {
      // Ne pas supprimer, juste desactiver
      await prisma.leaseTemplate.update({
        where: { id: templateId },
        data: { isActive: false, isDefault: false },
      });
    } else {
      await prisma.leaseTemplate.delete({ where: { id: templateId } });
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "LeaseTemplate",
      entityId: templateId,
    });

    revalidatePath("/baux/modeles");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteLeaseTemplate]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function getLeaseTemplates(societyId: string, leaseType?: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.leaseTemplate.findMany({
    where: {
      societyId,
      isActive: true,
      ...(leaseType ? { leaseType: leaseType as import("@/generated/prisma/client").LeaseType } : {}),
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { leases: true } },
    },
  });
}

export async function getLeaseTemplateById(societyId: string, templateId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return null;

  return prisma.leaseTemplate.findFirst({
    where: { id: templateId, societyId },
    include: {
      _count: { select: { leases: true } },
    },
  });
}
