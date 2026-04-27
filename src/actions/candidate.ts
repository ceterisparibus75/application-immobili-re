"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { checkSubscriptionActive } from "@/lib/plan-limits";
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
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

function candidateRiskIndicator(score?: number | null): "VERT" | "ORANGE" | "ROUGE" {
  if (score === null || score === undefined) return "VERT";
  if (score < 40) return "ROUGE";
  if (score < 70) return "ORANGE";
  return "VERT";
}

function candidateTenantNotes(candidate: {
  notes?: string | null;
  source?: string | null;
  monthlyIncome?: number | null;
  guarantorName?: string | null;
}) {
  const details = [
    candidate.source ? `Source candidature : ${candidate.source}` : null,
    candidate.monthlyIncome ? `Revenus déclarés : ${candidate.monthlyIncome.toLocaleString("fr-FR")} €/mois` : null,
    candidate.guarantorName ? `Garant : ${candidate.guarantorName}` : null,
    candidate.notes ? `Notes candidature : ${candidate.notes}` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join("\n") : null;
}

/* ─── Pipeline ──────────────────────────────────────────────────────── */

export async function createPipeline(
  societyId: string,
  input: CreatePipelineInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createPipelineSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const pipeline = await prisma.candidatePipeline.create({
      data: { societyId, ...parsed.data },
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id: pipeline.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
        userId: context.userId,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Candidate",
      entityId: candidate.id,
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id: candidate.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
            userId: context.userId,
          },
        });
      }
    }

    await prisma.candidate.update({ where: { id, societyId }, data: updateData });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Candidate",
      entityId: id,
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    await prisma.candidate.delete({ where: { id: candidateId, societyId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Candidate",
      entityId: candidateId,
    });

    revalidatePath("/candidatures");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteCandidate]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function convertCandidateToTenant(
  societyId: string,
  candidateId: string
): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const subscription = await checkSubscriptionActive(societyId);
    if (!subscription.active) {
      return {
        success: false,
        error: subscription.message ?? "Abonnement inactif. Souscrivez un plan pour continuer.",
      };
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, societyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        score: true,
        source: true,
        monthlyIncome: true,
        guarantorName: true,
        notes: true,
      },
    });

    if (!candidate) return { success: false, error: "Candidature introuvable" };
    if (!candidate.email) return { success: false, error: "Email requis pour créer le locataire" };

    const existingTenant = await prisma.tenant.findFirst({
      where: { societyId, email: candidate.email, deletedAt: null },
      select: { id: true },
    });

    if (existingTenant) {
      return {
        success: false,
        error: "Un locataire existe déjà avec cet email",
      };
    }

    const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();
    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          societyId,
          entityType: "PERSONNE_PHYSIQUE",
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email!,
          phone: candidate.phone,
          riskIndicator: candidateRiskIndicator(candidate.score),
          notes: candidateTenantNotes(candidate),
        },
        select: { id: true },
      });

      await tx.contact.create({
        data: {
          societyId,
          tenantId: createdTenant.id,
          contactType: "LOCATAIRE",
          name: fullName,
          company: candidate.company,
          email: candidate.email,
          phone: candidate.phone,
          notes: "Créé depuis une candidature",
        },
      });

      await tx.candidate.update({
        where: { id: candidate.id },
        data: { status: "ACCEPTED" },
      });

      await tx.candidateActivity.create({
        data: {
          candidateId: candidate.id,
          type: "STATUS_CHANGE",
          content: `Candidature convertie en locataire : ${fullName}`,
          userId: context.userId,
        },
      });

      return createdTenant;
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Tenant",
      entityId: tenant.id,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Candidate",
      entityId: candidate.id,
    });

    revalidatePath("/candidatures");
    revalidatePath(`/candidatures/${candidate.id}`);
    revalidatePath("/locataires");
    revalidatePath("/location/mise-en-location");
    return { success: true, data: { tenantId: tenant.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[convertCandidateToTenant]", error);
    return { success: false, error: "Erreur lors de la conversion" };
  }
}

/* ─── Activity ──────────────────────────────────────────────────────── */

export async function addActivity(
  societyId: string,
  input: AddActivityInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = addActivitySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const activity = await prisma.candidateActivity.create({
      data: { ...parsed.data, userId: context.userId },
    });

    revalidatePath("/candidatures");
    return { success: true, data: { id: activity.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addActivity]", error);
    return { success: false, error: "Erreur lors de l'ajout" };
  }
}
