"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  createCandidateSchema,
  updateCandidateSchema,
  createPipelineSchema,
  addActivitySchema,
  type CreateCandidateInput,
  type UpdateCandidateInput,
  type CreatePipelineInput,
  type AddActivityInput,
} from "@/validations/candidate";

/* ─── Pipeline ──────────────────────────────────────────────────────── */

export async function createPipeline(
  societyId: string,
  input: CreatePipelineInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createPipelineSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const pipeline = await prisma.candidatePipeline.create({
      data: { societyId, ...parsed.data },
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id: pipeline.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createPipeline]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

/* ─── Candidate CRUD ────────────────────────────────────────────────── */

export async function createCandidate(
  societyId: string,
  input: CreateCandidateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createCandidateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const data = {
      ...parsed.data,
      desiredMoveIn: parsed.data.desiredMoveIn ? new Date(parsed.data.desiredMoveIn) : undefined,
    };

    const candidate = await prisma.candidate.create({
      data: { societyId, ...data },
    });

    // Add initial activity
    await prisma.candidateActivity.create({
      data: {
        candidateId: candidate.id,
        type: "STATUS_CHANGE",
        content: "Candidature créée",
        userId: session.user.id,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Candidate",
      entityId: candidate.id,
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id: candidate.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createCandidate]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateCandidate(
  societyId: string,
  input: UpdateCandidateInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateCandidateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;
    const updateData = {
      ...data,
      desiredMoveIn: data.desiredMoveIn ? new Date(data.desiredMoveIn) : undefined,
    };

    // Track status change
    if (data.status) {
      const current = await prisma.candidate.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current && current.status !== data.status) {
        await prisma.candidateActivity.create({
          data: {
            candidateId: id,
            type: "STATUS_CHANGE",
            content: `Statut changé : ${current.status} → ${data.status}`,
            userId: session.user.id,
          },
        });
      }
    }

    await prisma.candidate.update({ where: { id, societyId }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Candidate",
      entityId: id,
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateCandidate]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteCandidate(
  societyId: string,
  candidateId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    await prisma.candidate.delete({ where: { id: candidateId, societyId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Candidate",
      entityId: candidateId,
    });

    revalidatePath("/candidatures");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteCandidate]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/* ─── Activity ──────────────────────────────────────────────────────── */

export async function addActivity(
  societyId: string,
  input: AddActivityInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = addActivitySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const activity = await prisma.candidateActivity.create({
      data: { ...parsed.data, userId: session.user.id },
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id: activity.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addActivity]", error);
    return { success: false, error: "Erreur lors de l'ajout" };
  }
}
