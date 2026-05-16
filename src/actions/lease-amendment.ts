"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  getOptionalSocietyActionContext,
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

/**
 * Cree un avenant pour un bail existant.
 */
export async function createLeaseAmendment(
  societyId: string,
  input: {
    leaseId: string;
    effectiveDate: string;
    description: string;
    amendmentType: string;
    newRentHT?: number;
    newEndDate?: string;
    otherChanges?: Record<string, unknown>;
    documentId?: string;
    lotsToAdd?: string[];
    lotsToRemove?: string[];
    newPrimaryLotId?: string;
  }
): Promise<ActionResult<{ id: string; amendmentNumber: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const lease = await prisma.lease.findFirst({
      where: { id: input.leaseId, societyId },
      include: {
        _count: { select: { amendments: true } },
        leaseLots: { select: { lotId: true, isPrimary: true } },
      },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    if (input.documentId) {
      const doc = await prisma.document.findFirst({
        where: { id: input.documentId, societyId, deletedAt: null },
      });
      if (!doc) return { success: false, error: "Document introuvable dans la GED" };
    }

    const amendmentNumber = lease._count.amendments + 1;

    const amendment = await prisma.$transaction(async (tx) => {
      const created = await tx.leaseAmendment.create({
        data: {
          leaseId: input.leaseId,
          amendmentNumber,
          effectiveDate: new Date(input.effectiveDate),
          description: input.description,
          amendmentType: input.amendmentType as "RENOUVELLEMENT" | "AVENANT_LOYER" | "AVENANT_DUREE" | "AVENANT_DIVERS" | "AVENANT_LOT" | "RESILIATION",
          previousRentHT: input.newRentHT ? lease.currentRentHT : null,
          newRentHT: input.newRentHT ?? null,
          previousEndDate: input.newEndDate ? lease.endDate : null,
          newEndDate: input.newEndDate ? new Date(input.newEndDate) : null,
          otherChanges: (input.otherChanges as Record<string, never>) ?? undefined,
          documentId: input.documentId ?? null,
        },
      });

      // Appliquer les modifications financieres et de date au bail
      const updates: Record<string, unknown> = {};
      if (input.newRentHT) updates.currentRentHT = input.newRentHT;
      if (input.newEndDate) updates.endDate = new Date(input.newEndDate);

      // Gestion des lots : ajout
      if (input.lotsToAdd && input.lotsToAdd.length > 0) {
        for (const lotId of input.lotsToAdd) {
          await tx.leaseLot.upsert({
            where: { leaseId_lotId: { leaseId: input.leaseId, lotId } },
            create: { leaseId: input.leaseId, lotId, isPrimary: false },
            update: {},
          });
          await tx.lot.update({ where: { id: lotId }, data: { status: "OCCUPE" } });
        }
      }

      // Gestion des lots : suppression (lots secondaires uniquement)
      if (input.lotsToRemove && input.lotsToRemove.length > 0) {
        for (const lotId of input.lotsToRemove) {
          const ll = lease.leaseLots.find((l) => l.lotId === lotId);
          if (ll?.isPrimary) continue; // securite : ne pas retirer le lot principal
          await tx.leaseLot.deleteMany({
            where: { leaseId: input.leaseId, lotId },
          });
          const remaining = await tx.leaseLot.count({
            where: { lotId, lease: { status: "EN_COURS", deletedAt: null } },
          });
          if (remaining === 0) {
            await tx.lot.update({ where: { id: lotId }, data: { status: "VACANT" } });
          }
        }
      }

      // Changement de lot principal
      if (input.newPrimaryLotId) {
        await tx.leaseLot.updateMany({
          where: { leaseId: input.leaseId },
          data: { isPrimary: false },
        });
        await tx.leaseLot.update({
          where: { leaseId_lotId: { leaseId: input.leaseId, lotId: input.newPrimaryLotId } },
          data: { isPrimary: true },
        });
        updates.lotId = input.newPrimaryLotId;
      }

      if (Object.keys(updates).length > 0) {
        await tx.lease.update({ where: { id: input.leaseId }, data: updates });
      }

      return created;
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LeaseAmendment",
      entityId: amendment.id,
      details: { leaseId: input.leaseId, amendmentType: input.amendmentType, amendmentNumber },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${input.leaseId}`);
    return {
      success: true,
      data: { id: amendment.id, amendmentNumber: amendment.amendmentNumber },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createLeaseAmendment]", error);
    return { success: false, error: "Erreur lors de la création de l'avenant" };
  }
}

/**
 * Retourne les lots disponibles pour etre ajoutes a un bail :
 * lots VACANT de la societe + lots deja sur ce bail.
 */
export async function getAvailableLotsForLease(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.lot.findMany({
    where: {
      building: { societyId },
      OR: [
        { status: "VACANT" },
        { leaseLots: { some: { leaseId } } },
      ],
    },
    include: {
      building: { select: { id: true, name: true, city: true } },
      leaseLots: { where: { leaseId }, select: { id: true, isPrimary: true } },
    },
    orderBy: [{ building: { name: "asc" } }, { number: "asc" }],
  });
}

/**
 * Renouvelle un bail : cree un avenant de type RENOUVELLEMENT,
 * etend la date de fin et optionnellement ajuste le loyer.
 */
export async function renewLease(
  societyId: string,
  input: {
    leaseId: string;
    newEndDate: string;
    newRentHT?: number;
    description?: string;
  }
): Promise<ActionResult<{ id: string; amendmentId: string }>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const lease = await prisma.lease.findFirst({
      where: { id: input.leaseId, societyId, status: "EN_COURS" },
    });
    if (!lease) return { success: false, error: "Bail introuvable ou inactif" };

    const newEnd = new Date(input.newEndDate);
    if (newEnd <= lease.endDate) {
      return { success: false, error: "La nouvelle date de fin doit être postérieure à l'actuelle" };
    }

    const result = await createLeaseAmendment(societyId, {
      leaseId: input.leaseId,
      effectiveDate: lease.endDate.toISOString(),
      description: input.description || `Renouvellement du bail jusqu'au ${newEnd.toLocaleDateString("fr-FR")}`,
      amendmentType: "RENOUVELLEMENT",
      newRentHT: input.newRentHT,
      newEndDate: input.newEndDate,
    });

    if (!result.success) return { success: false as const, error: result.error };
    return { success: true, data: { id: input.leaseId, amendmentId: result.data!.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[renewLease]", error);
    return { success: false, error: "Erreur lors du renouvellement" };
  }
}

/**
 * Recupere l'historique des avenants d'un bail.
 */
export async function getLeaseAmendments(societyId: string, leaseId: string) {
  const context = await getOptionalSocietyActionContext(societyId);
  if (!context) return [];

  return prisma.leaseAmendment.findMany({
    where: { leaseId, lease: { societyId } },
    orderBy: { amendmentNumber: "desc" },
  });
}