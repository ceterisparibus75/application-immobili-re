"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createDiagnosticSchema,
  updateDiagnosticSchema,
  type CreateDiagnosticInput,
  type UpdateDiagnosticInput,
} from "@/validations/diagnostic";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export async function createDiagnostic(
  societyId: string,
  input: CreateDiagnosticInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createDiagnosticSchema.safeParse(input);
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

    const diagnostic = await prisma.diagnostic.create({
      data: {
        buildingId: data.buildingId,
        type: data.type,
        performedAt: new Date(data.performedAt),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        result: data.result ?? null,
        fileUrl: data.fileUrl ?? null,
        fileStoragePath: data.fileStoragePath ?? null,
        aiAnalysis: data.aiAnalysis ?? null,
        aiAnalyzedAt: data.aiAnalysis ? new Date() : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Diagnostic",
      entityId: diagnostic.id,
      details: { type: diagnostic.type, buildingId: diagnostic.buildingId },
    });

    revalidatePath(`/patrimoine/immeubles/${data.buildingId}`);

    return { success: true, data: { id: diagnostic.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[createDiagnostic]", error);
    return { success: false, error: "Erreur lors de la création du diagnostic" };
  }
}

export async function updateDiagnostic(
  societyId: string,
  input: UpdateDiagnosticInput
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateDiagnosticSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, ...data } = parsed.data;

    const existing = await prisma.diagnostic.findFirst({
      where: { id, building: { societyId } },
    });
    if (!existing) {
      return { success: false, error: "Diagnostic introuvable" };
    }

    await prisma.diagnostic.update({
      where: { id },
      data: {
        ...data,
        performedAt: data.performedAt ? new Date(data.performedAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Diagnostic",
      entityId: id!,
    });

    revalidatePath(`/patrimoine/immeubles/${existing.buildingId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateDiagnostic]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteDiagnostic(
  societyId: string,
  diagnosticId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const existing = await prisma.diagnostic.findFirst({
      where: { id: diagnosticId, building: { societyId } },
    });
    if (!existing) {
      return { success: false, error: "Diagnostic introuvable" };
    }

    await prisma.diagnostic.delete({ where: { id: diagnosticId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Diagnostic",
      entityId: diagnosticId,
    });

    revalidatePath(`/patrimoine/immeubles/${existing.buildingId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deleteDiagnostic]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
