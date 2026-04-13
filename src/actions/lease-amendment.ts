"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

/**
 * Crée un avenant pour un bail existant.
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
  }
): Promise<ActionResult<{ id: string; amendmentNumber: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const lease = await prisma.lease.findFirst({
      where: { id: input.leaseId, societyId },
      include: { _count: { select: { amendments: true } } },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    const amendmentNumber = lease._count.amendments + 1;

    const amendment = await prisma.$transaction(async (tx) => {
      const created = await tx.leaseAmendment.create({
        data: {
          leaseId: input.leaseId,
          amendmentNumber,
          effectiveDate: new Date(input.effectiveDate),
          description: input.description,
          amendmentType: input.amendmentType as "RENOUVELLEMENT" | "AVENANT_LOYER" | "AVENANT_DUREE" | "AVENANT_DIVERS" | "RESILIATION",
          previousRentHT: input.newRentHT ? lease.currentRentHT : null,
          newRentHT: input.newRentHT ?? null,
          previousEndDate: input.newEndDate ? lease.endDate : null,
          newEndDate: input.newEndDate ? new Date(input.newEndDate) : null,
          otherChanges: (input.otherChanges as Record<string, never>) ?? undefined,
        },
      });

      // Appliquer les modifications au bail
      const updates: Record<string, unknown> = {};
      if (input.newRentHT) updates.currentRentHT = input.newRentHT;
      if (input.newEndDate) updates.endDate = new Date(input.newEndDate);

      if (Object.keys(updates).length > 0) {
        await tx.lease.update({
          where: { id: input.leaseId },
          data: updates,
        });
      }

      return created;
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
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
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createLeaseAmendment]", error);
    return { success: false, error: "Erreur lors de la création de l'avenant" };
  }
}

/**
 * Renouvelle un bail : crée un avenant de type RENOUVELLEMENT,
 * étend la date de fin et optionnellement ajuste le loyer.
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

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
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[renewLease]", error);
    return { success: false, error: "Erreur lors du renouvellement" };
  }
}

/**
 * Récupère l'historique des avenants d'un bail.
 */
export async function getLeaseAmendments(societyId: string, leaseId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.leaseAmendment.findMany({
    where: { leaseId, lease: { societyId } },
    orderBy: { amendmentNumber: "desc" },
  });
}
