"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { IndexType } from "@/generated/prisma/client";
import {
  validateRevisionSchema,
  rejectRevisionSchema,
  createManualRevisionSchema,
  type CreateManualRevisionInput,
} from "@/validations/rent-revision";

function calculateNewRent(
  currentRentHT: number,
  baseIndexValue: number,
  newIndexValue: number
): number {
  if (baseIndexValue <= 0) return currentRentHT;
  const newRent = currentRentHT * (newIndexValue / baseIndexValue);
  return Math.round(newRent * 100) / 100;
}

async function getLatestIndex(indexType: IndexType): Promise<{
  value: number;
  year: number;
  quarter: number;
} | null> {
  const index = await prisma.inseeIndex.findFirst({
    where: { indexType },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  });
  if (!index) return null;
  return { value: index.value, year: index.year, quarter: index.quarter };
}

export async function getPendingRevisions(
  societyId: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      effectiveDate: Date;
      previousRentHT: number;
      newRentHT: number;
      indexType: IndexType;
      baseIndexValue: number;
      newIndexValue: number;
      formula: string | null;
      isValidated: boolean;
      createdAt: Date;
      lease: {
        id: string;
        startDate: Date;
        currentRentHT: number;
        tenant: {
          id: string;
          entityType: string;
          companyName: string | null;
          firstName: string | null;
          lastName: string | null;
        };
        lot: {
          number: string;
          building: { id: string; name: string; city: string };
        };
      };
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const revisions = await prisma.rentRevision.findMany({
      where: {
        isValidated: false,
        lease: { societyId, status: "EN_COURS" },
      },
      include: {
        lease: {
          select: {
            id: true,
            startDate: true,
            currentRentHT: true,
            tenant: {
              select: {
                id: true,
                entityType: true,
                companyName: true,
                firstName: true,
                lastName: true,
              },
            },
            lot: {
              select: {
                number: true,
                building: { select: { id: true, name: true, city: true } },
              },
            },
          },
        },
      },
      orderBy: { effectiveDate: "asc" },
    });

    return { success: true, data: revisions };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[getPendingRevisions]", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des révisions",
    };
  }
}

export async function validateRevision(
  societyId: string,
  revisionId: string
): Promise<ActionResult<{ newRentHT: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = validateRevisionSchema.safeParse({ revisionId });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };

    const revision = await prisma.rentRevision.findFirst({
      where: { id: revisionId, lease: { societyId } },
      include: { lease: true },
    });

    if (!revision) return { success: false, error: "Révision introuvable" };
    if (revision.isValidated)
      return { success: false, error: "Cette révision est déjà validée" };

    await prisma.$transaction([
      prisma.rentRevision.update({
        where: { id: revisionId },
        data: {
          isValidated: true,
          validatedAt: new Date(),
          validatedBy: session.user.id,
        },
      }),
      prisma.lease.update({
        where: { id: revision.leaseId },
        data: {
          currentRentHT: revision.newRentHT,
          baseIndexValue: revision.newIndexValue,
        },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "RentRevision",
      entityId: revisionId,
      details: {
        action: "validate",
        leaseId: revision.leaseId,
        previousRentHT: revision.previousRentHT,
        newRentHT: revision.newRentHT,
        indexType: revision.indexType,
        baseIndex: revision.baseIndexValue,
        newIndex: revision.newIndexValue,
      },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${revision.leaseId}`);
    revalidatePath("/revisions");
    revalidatePath("/indices");

    return { success: true, data: { newRentHT: revision.newRentHT } };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[validateRevision]", error);
    return {
      success: false,
      error: "Erreur lors de la validation de la révision",
    };
  }
}

export async function rejectRevision(
  societyId: string,
  revisionId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = rejectRevisionSchema.safeParse({ revisionId });
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };

    const revision = await prisma.rentRevision.findFirst({
      where: { id: revisionId, lease: { societyId } },
    });

    if (!revision) return { success: false, error: "Révision introuvable" };
    if (revision.isValidated)
      return {
        success: false,
        error: "Impossible de rejeter une révision déjà validée",
      };

    await prisma.rentRevision.delete({ where: { id: revisionId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "RentRevision",
      entityId: revisionId,
      details: {
        action: "reject",
        leaseId: revision.leaseId,
        indexType: revision.indexType,
      },
    });

    revalidatePath("/baux");
    revalidatePath("/revisions");
    revalidatePath("/indices");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[rejectRevision]", error);
    return { success: false, error: "Erreur lors du rejet de la révision" };
  }
}

export async function createManualRevision(
  societyId: string,
  input: CreateManualRevisionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createManualRevisionSchema.safeParse(input);
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };

    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId, status: "EN_COURS" },
    });

    if (!lease) return { success: false, error: "Bail introuvable ou inactif" };
    if (!lease.indexType)
      return { success: false, error: "Ce bail n’a pas de clause d’indexation" };
    if (!lease.baseIndexValue)
      return { success: false, error: "Aucun indice de base défini sur ce bail" };

    const newRentHT = calculateNewRent(
      lease.currentRentHT,
      lease.baseIndexValue,
      parsed.data.newIndexValue
    );

    const formula = `${lease.currentRentHT.toFixed(2)} × (${parsed.data.newIndexValue} / ${lease.baseIndexValue}) = ${newRentHT.toFixed(2)}`;

    const revision = await prisma.rentRevision.create({
      data: {
        leaseId: lease.id,
        effectiveDate: new Date(parsed.data.effectiveDate),
        previousRentHT: lease.currentRentHT,
        newRentHT,
        indexType: lease.indexType,
        baseIndexValue: lease.baseIndexValue,
        newIndexValue: parsed.data.newIndexValue,
        formula,
        isValidated: false,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "RentRevision",
      entityId: revision.id,
      details: {
        leaseId: lease.id,
        previousRentHT: lease.currentRentHT,
        newRentHT,
        indexType: lease.indexType,
        formula,
      },
    });

    revalidatePath(`/baux/${lease.id}`);
    revalidatePath("/revisions");
    revalidatePath("/indices");

    return { success: true, data: { id: revision.id } };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[createManualRevision]", error);
    return {
      success: false,
      error: "Erreur lors de la création de la révision",
    };
  }
}

export async function detectPendingRevisions(): Promise<{
  created: number;
  errors: string[];
}> {
  const results = { created: 0, errors: [] as string[] };

  try {
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const leases = await prisma.lease.findMany({
      where: {
        status: "EN_COURS",
        indexType: { not: null },
        baseIndexValue: { not: null },
      },
      include: {
        rentRevisions: {
          orderBy: { effectiveDate: "desc" },
          take: 1,
        },
        tenant: {
          select: {
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
        lot: {
          select: {
            number: true,
            building: { select: { name: true } },
          },
        },
        society: {
          select: {
            id: true,
            userSocieties: {
              where: { role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] } },
              select: { userId: true },
            },
          },
        },
      },
    });

    for (const lease of leases) {
      try {
        if (!lease.indexType || !lease.baseIndexValue) continue;

        const nextRevisionDate = getNextRevisionDate(
          lease.startDate,
          lease.revisionFrequency ?? 12,
          lease.rentRevisions[0]?.effectiveDate
        );

        if (nextRevisionDate > in30Days || nextRevisionDate < threeMonthsAgo) continue;

        const existingPending = await prisma.rentRevision.findFirst({
          where: { leaseId: lease.id, isValidated: false },
        });
        if (existingPending) continue;

        const latestIndex = await getLatestIndex(lease.indexType as IndexType);
        if (!latestIndex) {
          results.errors.push(`Bail ${lease.id} : aucun indice ${lease.indexType} disponible`);
          continue;
        }

        if (latestIndex.value === lease.baseIndexValue) continue;

        const newRentHT = calculateNewRent(lease.currentRentHT, lease.baseIndexValue, latestIndex.value);
        const formula = `${lease.currentRentHT.toFixed(2)} × (${latestIndex.value} / ${lease.baseIndexValue}) = ${newRentHT.toFixed(2)}`;

        await prisma.rentRevision.create({
          data: {
            leaseId: lease.id,
            effectiveDate: nextRevisionDate,
            previousRentHT: lease.currentRentHT,
            newRentHT,
            indexType: lease.indexType as IndexType,
            baseIndexValue: lease.baseIndexValue,
            newIndexValue: latestIndex.value,
            formula,
            isValidated: false,
          },
        });

        const tenantName =
          lease.tenant.entityType === "PERSONNE_MORALE"
            ? (lease.tenant.companyName ?? "—")
            : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";

        const buildingName = lease.lot?.building?.name ?? "—";
        const lotNumber = lease.lot?.number ?? "—";

        for (const userSociety of lease.society.userSocieties) {
          await prisma.notification.create({
            data: {
              userId: userSociety.userId,
              societyId: lease.societyId,
              type: "RENT_REVISION",
              title: "Révision de loyer à valider",
              message: `${buildingName} — Lot ${lotNumber} (${tenantName}) : révision prévue le ${nextRevisionDate.toLocaleDateString("fr-FR")}. Nouveau loyer proposé : ${newRentHT.toFixed(2)} € HT.`,
              link: "/revisions",
            },
          });
        }

        results.created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        results.errors.push(`Bail ${lease.id} : ${msg}`);
      }
    }
  } catch (error) {
    console.error("[detectPendingRevisions]", error);
    results.errors.push(error instanceof Error ? error.message : "Erreur globale");
  }

  return results;
}

function getNextRevisionDate(
  startDate: Date,
  frequencyMonths: number,
  lastRevisionDate?: Date
): Date {
  const now = new Date();

  if (lastRevisionDate) {
    const nextDate = new Date(lastRevisionDate);
    nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
    return nextDate;
  }

  const nextDate = new Date(startDate);
  while (nextDate <= now) {
    nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
  }

  return nextDate;
}
