"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  createReportScheduleSchema,
  updateReportScheduleSchema,
  type CreateReportScheduleInput,
  type UpdateReportScheduleInput,
} from "@/validations/report";
import { computeNextRunAt } from "@/lib/reports/consolidated";

// ── Liste des planifications ───────────────────────────────────

export async function getReportSchedules(
  societyId: string
): Promise<ActionResult<{ schedules: Array<{
  id: string;
  name: string;
  frequency: string;
  reportTypes: string[];
  recipients: string[];
  isActive: boolean;
  lastSentAt: Date | null;
  nextRunAt: Date;
  createdBy: { name: string | null; email: string };
  createdAt: Date;
}> }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const schedules = await prisma.reportSchedule.findMany({
      where: { societyId },
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: { schedules } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getReportSchedules]", error);
    return { success: false, error: "Erreur lors du chargement des planifications" };
  }
}

// ── Création ───────────────────────────────────────────────────

export async function createReportSchedule(
  societyId: string,
  input: CreateReportScheduleInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createReportScheduleSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const nextRunAt = computeNextRunAt(parsed.data.frequency);

    const schedule = await prisma.reportSchedule.create({
      data: {
        societyId,
        createdById: session.user.id,
        name: parsed.data.name,
        frequency: parsed.data.frequency,
        reportTypes: parsed.data.reportTypes,
        recipients: parsed.data.recipients,
        nextRunAt,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ReportSchedule",
      entityId: schedule.id,
      details: { name: schedule.name, frequency: schedule.frequency, recipients: schedule.recipients },
    });

    revalidatePath("/rapports/planification");
    return { success: true, data: { id: schedule.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createReportSchedule]", error);
    return { success: false, error: "Erreur lors de la création de la planification" };
  }
}

// ── Mise à jour ────────────────────────────────────────────────

export async function updateReportSchedule(
  societyId: string,
  input: UpdateReportScheduleInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateReportScheduleSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;

    // Recalculer nextRunAt si la fréquence change
    const updateData: Record<string, unknown> = { ...data };
    if (data.frequency) {
      updateData.nextRunAt = computeNextRunAt(data.frequency);
    }

    await prisma.reportSchedule.update({
      where: { id, societyId },
      data: updateData,
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "ReportSchedule",
      entityId: id,
      details: data,
    });

    revalidatePath("/rapports/planification");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateReportSchedule]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

// ── Suppression ────────────────────────────────────────────────

export async function deleteReportSchedule(
  societyId: string,
  scheduleId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    await prisma.reportSchedule.delete({
      where: { id: scheduleId, societyId },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "ReportSchedule",
      entityId: scheduleId,
    });

    revalidatePath("/rapports/planification");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteReportSchedule]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

// ── Activation / Désactivation ─────────────────────────────────

export async function toggleReportSchedule(
  societyId: string,
  scheduleId: string,
  isActive: boolean
): Promise<ActionResult> {
  return updateReportSchedule(societyId, { id: scheduleId, isActive });
}
