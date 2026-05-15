"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { createAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createOwnershipSchema,
  endOwnershipSchema,
  splitToUsufructSchema,
  updateOwnershipSchema,
  type CreateOwnershipInput,
  type EndOwnershipInput,
  type SplitToUsufructInput,
  type UpdateOwnershipInput,
} from "@/validations/lot-ownership";

/** Retourne la liste complète (historique) des quote-parts d'un lot. */
export async function getLotOwnerships(societyId: string, lotId: string) {
  await requireSocietyActionContext(societyId, "LECTURE");

  return prisma.lotOwnership.findMany({
    where: { societyId, lotId },
    include: {
      proprietaire: { select: { id: true, label: true, entityType: true } },
    },
    orderBy: [{ startDate: "asc" }, { type: "asc" }],
  });
}

/**
 * Vérifie que le lot appartient bien à la société du contexte
 * (sécurité multi-tenant : société → building → lot).
 * Renvoie le buildingId du lot, ou null si inaccessible.
 */
async function ensureLotInSociety(societyId: string, lotId: string): Promise<string | null> {
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, building: { societyId } },
    select: { buildingId: true },
  });
  return lot?.buildingId ?? null;
}

async function ensureProprietaireInSociety(societyId: string, proprietaireId: string): Promise<boolean> {
  const proprietaire = await prisma.proprietaire.findFirst({
    where: { id: proprietaireId, societies: { some: { id: societyId } } },
    select: { id: true },
  });
  return proprietaire !== null;
}

export async function createOwnership(
  societyId: string,
  input: CreateOwnershipInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createOwnershipSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const data = parsed.data;

    const buildingId = await ensureLotInSociety(societyId, data.lotId);
    if (!buildingId) {
      return { success: false, error: "Lot introuvable" };
    }
    if (!(await ensureProprietaireInSociety(societyId, data.proprietaireId))) {
      return { success: false, error: "Propriétaire introuvable pour cette société" };
    }

    const ownership = await prisma.lotOwnership.create({
      data: {
        societyId,
        lotId: data.lotId,
        proprietaireId: data.proprietaireId,
        type: data.type,
        share: data.share,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isViager: data.isViager ?? false,
        usufruitierBirthDate: data.usufruitierBirthDate ? new Date(data.usufruitierBirthDate) : null,
        notes: data.notes ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LotOwnership",
      entityId: ownership.id,
      details: { lotId: data.lotId, type: data.type, share: data.share },
    });

    revalidatePath(`/patrimoine/immeubles/${buildingId}/lots/${data.lotId}`);
    return { success: true, data: { id: ownership.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createOwnership]", error);
    return { success: false, error: "Erreur lors de la création de la quote-part" };
  }
}

/**
 * Démembrement atomique d'un lot :
 *  1. ferme la (les) pleine(s) propriété(s) actives à `startDate`
 *  2. crée les parts d'usufruit
 *  3. crée les parts de nue-propriété
 * Si une PP active dépasse `startDate`, son `endDate` est mise à jour ;
 * sinon erreur (rien à démembrer).
 */
export async function splitLotToUsufruct(
  societyId: string,
  input: SplitToUsufructInput,
): Promise<ActionResult<{ created: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = splitToUsufructSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const data = parsed.data;

    const buildingId = await ensureLotInSociety(societyId, data.lotId);
    if (!buildingId) {
      return { success: false, error: "Lot introuvable" };
    }

    const proprietaireIds = [
      ...data.usufruit.map((u) => u.proprietaireId),
      ...data.nuePropriete.map((n) => n.proprietaireId),
    ];
    for (const id of new Set(proprietaireIds)) {
      if (!(await ensureProprietaireInSociety(societyId, id))) {
        return { success: false, error: `Propriétaire introuvable : ${id}` };
      }
    }

    const startDate = new Date(data.startDate);

    const created = await prisma.$transaction(async (tx) => {
      const activePP = await tx.lotOwnership.findMany({
        where: {
          societyId,
          lotId: data.lotId,
          type: "PLEINE_PROPRIETE",
          startDate: { lte: startDate },
          OR: [{ endDate: null }, { endDate: { gt: startDate } }],
        },
      });

      if (activePP.length === 0) {
        throw new Error("Aucune pleine propriété active à démembrer à cette date");
      }

      for (const pp of activePP) {
        await tx.lotOwnership.update({
          where: { id: pp.id },
          data: { endDate: startDate },
        });
      }

      const usCreate = data.usufruit.map((u) =>
        tx.lotOwnership.create({
          data: {
            societyId,
            lotId: data.lotId,
            proprietaireId: u.proprietaireId,
            type: "USUFRUIT",
            share: u.share,
            startDate,
            endDate: u.endDate ? new Date(u.endDate) : null,
            isViager: u.isViager ?? false,
            usufruitierBirthDate: u.usufruitierBirthDate ? new Date(u.usufruitierBirthDate) : null,
            notes: data.notes ?? null,
          },
        }),
      );

      const npCreate = data.nuePropriete.map((n) =>
        tx.lotOwnership.create({
          data: {
            societyId,
            lotId: data.lotId,
            proprietaireId: n.proprietaireId,
            type: "NUE_PROPRIETE",
            share: n.share,
            startDate,
            notes: data.notes ?? null,
          },
        }),
      );

      const results = await Promise.all([...usCreate, ...npCreate]);
      return results.length;
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LotOwnership",
      entityId: data.lotId,
      details: {
        operation: "SPLIT_TO_USUFRUCT",
        lotId: data.lotId,
        usufruit: data.usufruit.length,
        nuePropriete: data.nuePropriete.length,
      },
    });

    revalidatePath(`/patrimoine/immeubles/${buildingId}/lots/${data.lotId}`);
    return { success: true, data: { created } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    if (error instanceof Error && error.message.includes("Aucune pleine propriété")) {
      return { success: false, error: error.message };
    }
    console.error("[splitLotToUsufruct]", error);
    return { success: false, error: "Erreur lors du démembrement" };
  }
}

export async function updateOwnership(
  societyId: string,
  input: UpdateOwnershipInput,
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateOwnershipSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const { id, ...data } = parsed.data;

    const existing = await prisma.lotOwnership.findFirst({
      where: { id, societyId },
      select: { id: true, lotId: true, lot: { select: { buildingId: true } } },
    });
    if (!existing) {
      return { success: false, error: "Quote-part introuvable" };
    }

    if (data.proprietaireId && !(await ensureProprietaireInSociety(societyId, data.proprietaireId))) {
      return { success: false, error: "Propriétaire introuvable pour cette société" };
    }

    await prisma.lotOwnership.update({
      where: { id },
      data: {
        proprietaireId: data.proprietaireId,
        type: data.type,
        share: data.share,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate) : null,
        isViager: data.isViager,
        usufruitierBirthDate:
          data.usufruitierBirthDate === undefined
            ? undefined
            : data.usufruitierBirthDate
              ? new Date(data.usufruitierBirthDate)
              : null,
        notes: data.notes === undefined ? undefined : data.notes,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LotOwnership",
      entityId: id,
    });

    revalidatePath(`/patrimoine/immeubles/${existing.lot.buildingId}/lots/${existing.lotId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateOwnership]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

/**
 * Met fin à une quote-part (extinction d'usufruit, réunion). Ne supprime pas
 * la ligne : la conserver permet de reconstituer l'historique.
 */
export async function endOwnership(
  societyId: string,
  input: EndOwnershipInput,
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = endOwnershipSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const { id, endDate, notes } = parsed.data;

    const existing = await prisma.lotOwnership.findFirst({
      where: { id, societyId },
      select: { id: true, lotId: true, startDate: true, notes: true, lot: { select: { buildingId: true } } },
    });
    if (!existing) {
      return { success: false, error: "Quote-part introuvable" };
    }

    const end = new Date(endDate);
    if (end <= existing.startDate) {
      return { success: false, error: "La date de fin doit être postérieure à la date de début" };
    }

    await prisma.lotOwnership.update({
      where: { id },
      data: {
        endDate: end,
        notes: notes ?? existing.notes,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LotOwnership",
      entityId: id,
      details: { operation: "END_OWNERSHIP", endDate },
    });

    revalidatePath(`/patrimoine/immeubles/${existing.lot.buildingId}/lots/${existing.lotId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[endOwnership]", error);
    return { success: false, error: "Erreur lors de la clôture de la quote-part" };
  }
}

export async function deleteOwnership(societyId: string, id: string): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const existing = await prisma.lotOwnership.findFirst({
      where: { id, societyId },
      select: { id: true, lotId: true, lot: { select: { buildingId: true } } },
    });
    if (!existing) {
      return { success: false, error: "Quote-part introuvable" };
    }

    await prisma.lotOwnership.delete({ where: { id } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "LotOwnership",
      entityId: id,
    });

    revalidatePath(`/patrimoine/immeubles/${existing.lot.buildingId}/lots/${existing.lotId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteOwnership]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
