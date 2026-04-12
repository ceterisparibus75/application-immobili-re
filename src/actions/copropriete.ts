"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  createCoproprieteSchema,
  updateCoproprieteSchema,
  createCoproLotSchema,
  updateCoproLotSchema,
  createCoproBudgetSchema,
  updateCoproBudgetSchema,
  createAssemblySchema,
  updateAssemblySchema,
  createResolutionSchema,
  recordVoteSchema,
  type CreateCoproprieteInput,
  type UpdateCoproprieteInput,
  type CreateCoproLotInput,
  type UpdateCoproLotInput,
  type CreateCoproBudgetInput,
  type UpdateCoproBudgetInput,
  type CreateAssemblyInput,
  type UpdateAssemblyInput,
  type CreateResolutionInput,
  type RecordVoteInput,
} from "@/validations/copropriete";
import { ForbiddenError } from "@/lib/permissions";

/* ─── Copropriété CRUD ──────────────────────────────────────────────── */

export async function createCopropriete(
  societyId: string,
  input: CreateCoproprieteInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createCoproprieteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const copro = await prisma.copropriete.create({
      data: { societyId, ...parsed.data },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Copropriete",
      entityId: copro.id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id: copro.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createCopropriete]", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateCopropriete(
  societyId: string,
  input: UpdateCoproprieteInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateCoproprieteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;
    await prisma.copropriete.update({ where: { id, societyId }, data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Copropriete",
      entityId: id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateCopropriete]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteCopropriete(
  societyId: string,
  coproprieteId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    await prisma.copropriete.delete({ where: { id: coproprieteId, societyId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Copropriete",
      entityId: coproprieteId,
    });

    revalidatePath("/copropriete");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteCopropriete]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/* ─── Lots de copropriété ───────────────────────────────────────────── */

export async function createCoproLot(
  societyId: string,
  input: CreateCoproLotInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createCoproLotSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const lot = await prisma.coproLot.create({ data: parsed.data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "CoproLot",
      entityId: lot.id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id: lot.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createCoproLot]", error);
    return { success: false, error: "Erreur lors de la création du lot" };
  }
}

export async function updateCoproLot(
  societyId: string,
  input: UpdateCoproLotInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateCoproLotSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;
    await prisma.coproLot.update({ where: { id }, data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "CoproLot",
      entityId: id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateCoproLot]", error);
    return { success: false, error: "Erreur lors de la mise à jour du lot" };
  }
}

export async function deleteCoproLot(
  societyId: string,
  lotId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    await prisma.coproLot.delete({ where: { id: lotId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "CoproLot",
      entityId: lotId,
    });

    revalidatePath("/copropriete");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteCoproLot]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

/* ─── Budget prévisionnel ───────────────────────────────────────────── */

export async function createCoproBudget(
  societyId: string,
  input: CreateCoproBudgetInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createCoproBudgetSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const budget = await prisma.coproBudget.create({ data: parsed.data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "CoproBudget",
      entityId: budget.id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id: budget.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createCoproBudget]", error);
    return { success: false, error: "Erreur lors de la création du budget" };
  }
}

export async function approveBudget(
  societyId: string,
  budgetId: string,
  assemblyId?: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    await prisma.coproBudget.update({
      where: { id: budgetId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByAssemblyId: assemblyId,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "CoproBudget",
      entityId: budgetId,
    });

    revalidatePath("/copropriete");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[approveBudget]", error);
    return { success: false, error: "Erreur lors de l'approbation" };
  }
}

/* ─── Assemblées Générales ──────────────────────────────────────────── */

export async function createAssembly(
  societyId: string,
  input: CreateAssemblyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createAssemblySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const assembly = await prisma.coproAssembly.create({
      data: { ...parsed.data, date: new Date(parsed.data.date) },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "CoproAssembly",
      entityId: assembly.id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id: assembly.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createAssembly]", error);
    return { success: false, error: "Erreur lors de la création de l'AG" };
  }
}

export async function updateAssembly(
  societyId: string,
  input: UpdateAssemblyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateAssemblySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const { id, ...data } = parsed.data;
    const updateData = data.date ? { ...data, date: new Date(data.date) } : data;
    await prisma.coproAssembly.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "CoproAssembly",
      entityId: id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateAssembly]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

/* ─── Résolutions & Votes ───────────────────────────────────────────── */

export async function createResolution(
  societyId: string,
  input: CreateResolutionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createResolutionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const resolution = await prisma.coproResolution.create({ data: parsed.data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "CoproResolution",
      entityId: resolution.id,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id: resolution.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createResolution]", error);
    return { success: false, error: "Erreur lors de la création de la résolution" };
  }
}

export async function recordVote(
  societyId: string,
  input: RecordVoteInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = recordVoteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    // Upsert: if vote already exists for this lot+resolution, update it
    const vote = await prisma.coproVote.upsert({
      where: {
        resolutionId_lotId: {
          resolutionId: parsed.data.resolutionId,
          lotId: parsed.data.lotId,
        },
      },
      create: parsed.data,
      update: {
        vote: parsed.data.vote,
        proxy: parsed.data.proxy,
        proxyName: parsed.data.proxyName,
      },
    });

    // Recalculate resolution totals
    const votes = await prisma.coproVote.findMany({
      where: { resolutionId: parsed.data.resolutionId },
      include: { lot: { select: { tantiemes: true } } },
    });

    let votesFor = 0;
    let votesAgainst = 0;
    let abstentions = 0;
    for (const v of votes) {
      if (v.vote === "POUR") votesFor += v.lot.tantiemes;
      else if (v.vote === "CONTRE") votesAgainst += v.lot.tantiemes;
      else abstentions += v.lot.tantiemes;
    }

    await prisma.coproResolution.update({
      where: { id: parsed.data.resolutionId },
      data: { votesFor, votesAgainst, abstentions },
    });

    revalidatePath("/copropriete");
    return { success: true, data: { id: vote.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[recordVote]", error);
    return { success: false, error: "Erreur lors de l'enregistrement du vote" };
  }
}

export async function closeResolution(
  societyId: string,
  resolutionId: string
): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const resolution = await prisma.coproResolution.findUnique({
      where: { id: resolutionId },
      include: {
        assembly: {
          include: { copropriete: { select: { totalTantiemes: true } } },
        },
      },
    });

    if (!resolution) return { success: false, error: "Résolution introuvable" };

    const total = resolution.assembly.copropriete.totalTantiemes;
    const votesFor = resolution.votesFor;
    const votesAgainst = resolution.votesAgainst;
    const totalVoted = votesFor + votesAgainst + resolution.abstentions;

    let adopted = false;
    switch (resolution.majority) {
      case "SIMPLE":
        adopted = votesFor > votesAgainst;
        break;
      case "ABSOLUE":
        adopted = votesFor > total / 2;
        break;
      case "DOUBLE":
        adopted = votesFor >= (total * 2) / 3;
        break;
      case "UNANIMITE":
        adopted = votesFor === total;
        break;
    }

    const status = adopted ? "ADOPTED" : "REJECTED";
    await prisma.coproResolution.update({
      where: { id: resolutionId },
      data: { status },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "CoproResolution",
      entityId: resolutionId,
    });

    revalidatePath("/copropriete");
    return { success: true, data: { status } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[closeResolution]", error);
    return { success: false, error: "Erreur lors de la clôture" };
  }
}
