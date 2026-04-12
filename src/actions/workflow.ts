"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
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

export async function createWorkflow(
  societyId: string,
  input: CreateWorkflowInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

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
      userId: session.user.id,
      action: "CREATE",
      entity: "Workflow",
      entityId: workflow.id,
    });

    revalidatePath("/workflows");
    return { success: true, data: { id: workflow.id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const parsed = updateWorkflowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, trigger, steps, ...rest } = parsed.data;
    const updateData: Prisma.WorkflowUpdateInput = { ...rest };
    if (trigger) updateData.trigger = trigger as unknown as Prisma.InputJsonValue;
    if (steps) updateData.steps = steps as unknown as Prisma.InputJsonValue;
    await prisma.workflow.update({ where: { id, societyId }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Workflow",
      entityId: id,
    });

    revalidatePath("/workflows");
    return { success: true, data: { id } };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    await prisma.workflow.delete({ where: { id: workflowId, societyId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Workflow",
      entityId: workflowId,
    });

    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    await prisma.workflow.update({
      where: { id: workflowId, societyId },
      data: { isActive },
    });

    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        triggeredBy: session.user.id,
        status: "RUNNING",
      },
    });

    // Update workflow stats
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { lastRunAt: new Date(), runCount: { increment: 1 } },
    });

    // In a real implementation, this would trigger async execution
    // For now, mark as completed
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "WorkflowRun",
      entityId: run.id,
    });

    revalidatePath("/workflows");
    return { success: true, data: { runId: run.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[runWorkflow]", error);
    return { success: false, error: "Erreur lors de l'exécution" };
  }
}
