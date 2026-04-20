"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
} from "@/validations/workflow";
import { executeWorkflowSteps } from "@/lib/workflow-engine";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export async function createWorkflow(
  societyId: string,
  input: CreateWorkflowInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const parsed = createWorkflowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { trigger, steps, ...rest } = parsed.data;
    const workflow = await prisma.workflow.create({
      data: {
        societyId,
        ...rest,
        trigger: trigger as unknown as Prisma.InputJsonValue,
        steps: steps as unknown as Prisma.InputJsonValue,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Workflow",
      entityId: workflow.id,
    });

    revalidatePath("/workflows");
    return { success: true, data: { id: workflow.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createWorkflow]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateWorkflow(
  societyId: string,
  input: UpdateWorkflowInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const parsed = updateWorkflowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, trigger, steps, ...rest } = parsed.data;
    const updateData: Prisma.WorkflowUpdateInput = { ...rest };
    if (trigger) updateData.trigger = trigger as unknown as Prisma.InputJsonValue;
    if (steps) updateData.steps = steps as unknown as Prisma.InputJsonValue;
    await prisma.workflow.update({ where: { id, societyId }, data: updateData });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Workflow",
      entityId: id,
    });

    revalidatePath("/workflows");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateWorkflow]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteWorkflow(
  societyId: string,
  workflowId: string
): Promise<ActionResult<void>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    await prisma.workflow.delete({ where: { id: workflowId, societyId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Workflow",
      entityId: workflowId,
    });

    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteWorkflow]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

export async function toggleWorkflow(
  societyId: string,
  workflowId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    await prisma.workflow.update({
      where: { id: workflowId, societyId },
      data: { isActive },
    });

    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[toggleWorkflow]", error);
    return { success: false, error: "Erreur lors du changement d'état" };
  }
}

export async function runWorkflow(
  societyId: string,
  workflowId: string
): Promise<ActionResult<{ runId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, societyId },
    });
    if (!workflow) return { success: false, error: "Workflow introuvable" };

    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        triggeredBy: context.userId,
        status: "RUNNING",
      },
    });

    // Exécuter les étapes réellement
    const steps = (workflow.steps as Array<{ id: string; type: string; config: Record<string, unknown> }>) ?? [];
    const stepResults = await executeWorkflowSteps(steps, {
      societyId,
      triggeredBy: context.userId,
    });

    const hasFailed = stepResults.some((r) => r.status === "failed");

    await Promise.all([
      prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: hasFailed ? "FAILED" : "COMPLETED",
          completedAt: new Date(),
          stepResults: stepResults as never,
          ...(hasFailed
            ? { error: stepResults.find((r) => r.status === "failed")?.error }
            : {}),
        },
      }),
      prisma.workflow.update({
        where: { id: workflowId },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "WorkflowRun",
      entityId: run.id,
    });

    revalidatePath("/workflows");
    return { success: true, data: { runId: run.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[runWorkflow]", error);
    return { success: false, error: "Erreur lors de l'exécution" };
  }
}
