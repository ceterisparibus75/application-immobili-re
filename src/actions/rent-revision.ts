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

/** Récupère l'indice pour un trimestre de référence précis (ex: T3 de l'année cible) */
async function getIndexForReferenceQuarter(
  indexType: IndexType,
  referenceQuarter: number,
  targetYear: number
): Promise<{ value: number; year: number; quarter: number } | null> {
  const index = await prisma.inseeIndex.findFirst({
    where: { indexType, quarter: referenceQuarter, year: targetYear },
  });
  if (!index) return null;
  return { value: index.value, year: index.year, quarter: index.quarter };
}

/** Parse un trimestre de référence "T3 2024" → { quarter: 3, year: 2024 } */
function parseBaseIndexQuarter(baseIndexQuarter: string | null): { quarter: number; year: number } | null {
  if (!baseIndexQuarter) return null;
  const match = baseIndexQuarter.match(/T(\d)\s*(\d{4})/);
  if (!match) return null;
  return { quarter: parseInt(match[1]), year: parseInt(match[2]) };
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
    revalidatePath("/baux/revisions");
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
    revalidatePath("/baux/revisions");
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
    revalidatePath("/baux/revisions");
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
          lease.rentRevisions[0]?.effectiveDate,
          lease.entryDate,
          lease.revisionDateBasis,
          lease.revisionCustomMonth,
          lease.revisionCustomDay,
        );

        if (nextRevisionDate > in30Days || nextRevisionDate < threeMonthsAgo) continue;

        const existingPending = await prisma.rentRevision.findFirst({
          where: { leaseId: lease.id, isValidated: false },
        });
        if (existingPending) continue;

        // Déterminer le trimestre de référence et l'année cible
        const baseQuarterInfo = parseBaseIndexQuarter(lease.baseIndexQuarter);
        let newIndex: { value: number; year: number; quarter: number } | null = null;

        if (baseQuarterInfo) {
          // Calculer l'année cible : année de la prochaine révision
          const targetYear = nextRevisionDate.getFullYear();
          // Chercher d'abord l'indice du même trimestre pour l'année cible
          newIndex = await getIndexForReferenceQuarter(
            lease.indexType as IndexType,
            baseQuarterInfo.quarter,
            targetYear
          );
          // Si pas disponible, essayer l'année précédente
          if (!newIndex) {
            newIndex = await getIndexForReferenceQuarter(
              lease.indexType as IndexType,
              baseQuarterInfo.quarter,
              targetYear - 1
            );
          }
        }

        // Fallback : dernier indice disponible si pas de trimestre de référence
        if (!newIndex) {
          newIndex = await getLatestIndex(lease.indexType as IndexType);
        }

        if (!newIndex) {
          results.errors.push(`Bail ${lease.id} : aucun indice ${lease.indexType} disponible`);
          continue;
        }

        if (newIndex.value === lease.baseIndexValue) continue;

        const newRentHT = calculateNewRent(lease.currentRentHT, lease.baseIndexValue, newIndex.value);
        const quarterLabel = `T${newIndex.quarter} ${newIndex.year}`;
        const formula = `${lease.currentRentHT.toFixed(2)} × (${newIndex.value} [${quarterLabel}] / ${lease.baseIndexValue}) = ${newRentHT.toFixed(2)}`;

        await prisma.rentRevision.create({
          data: {
            leaseId: lease.id,
            effectiveDate: nextRevisionDate,
            previousRentHT: lease.currentRentHT,
            newRentHT,
            indexType: lease.indexType as IndexType,
            baseIndexValue: lease.baseIndexValue,
            newIndexValue: newIndex.value,
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
              link: "/baux/revisions",
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

function getRevisionAnchorDate(
  startDate: Date,
  entryDate: Date | null,
  revisionDateBasis: string | null,
  customMonth: number | null,
  customDay: number | null,
): Date {
  switch (revisionDateBasis) {
    case "DATE_ENTREE":
      return entryDate ?? startDate;
    case "PREMIER_JANVIER": {
      const year = startDate.getFullYear() + 1;
      return new Date(year, 0, 1);
    }
    case "DATE_PERSONNALISEE": {
      const m = (customMonth ?? 1) - 1;
      const d = customDay ?? 1;
      const custom = new Date(startDate.getFullYear(), m, d);
      if (custom <= startDate) custom.setFullYear(custom.getFullYear() + 1);
      return custom;
    }
    case "DATE_SIGNATURE":
    default:
      return startDate;
  }
}

function getNextRevisionDate(
  startDate: Date,
  frequencyMonths: number,
  lastRevisionDate?: Date,
  entryDate?: Date | null,
  revisionDateBasis?: string | null,
  customMonth?: number | null,
  customDay?: number | null,
): Date {
  if (lastRevisionDate) {
    const nextDate = new Date(lastRevisionDate);
    nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
    return nextDate;
  }
  const anchor = getRevisionAnchorDate(startDate, entryDate ?? null, revisionDateBasis ?? null, customMonth ?? null, customDay ?? null);
  if (revisionDateBasis === "PREMIER_JANVIER" || revisionDateBasis === "DATE_PERSONNALISEE") {
    return anchor;
  }
  const nextDate = new Date(anchor);
  nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
  return nextDate;
}

// ── Rattrapage chaîné année par année ──────────────────────────────────

export interface ChainStep {
  year: number;
  quarter: number;
  fromIndex: number;
  toIndex: number;
  rentBefore: number;
  rentAfter: number;
  effectiveDate: string; // ISO
}

export interface CatchUpResult {
  steps: ChainStep[];
  finalRent: number;
  finalIndexValue: number;
  formulaSummary: string;
}

/**
 * Trouve l'indice INSEE le plus proche de baseIndexValue.
 * Si un trimestre de référence est connu, cherche d'abord dans ce trimestre.
 * Sinon, cherche dans TOUS les trimestres pour trouver le meilleur match.
 * Retourne le trimestre et l'année de base.
 */
async function findBaseIndexInfo(
  indexType: IndexType,
  baseIndexValue: number,
  preferredQuarter?: number | null
): Promise<{ year: number; quarter: number } | null> {
  // Si on a un trimestre préféré, chercher d'abord dedans
  if (preferredQuarter) {
    const candidates = await prisma.inseeIndex.findMany({
      where: { indexType, quarter: preferredQuarter },
      orderBy: { year: "asc" },
    });
    const match = findClosestIndex(candidates, baseIndexValue);
    if (match) return { year: match.year, quarter: preferredQuarter };
  }

  // Chercher dans TOUS les trimestres
  const allCandidates = await prisma.inseeIndex.findMany({
    where: { indexType },
    orderBy: { year: "asc" },
  });
  const match = findClosestIndex(allCandidates, baseIndexValue);
  if (match) return { year: match.year, quarter: match.quarter };

  return null;
}

/** Trouve l'indice le plus proche d'une valeur cible (tolérance 5%) */
function findClosestIndex(
  candidates: Array<{ value: number; year: number; quarter: number }>,
  targetValue: number
): { year: number; quarter: number } | null {
  if (candidates.length === 0) return null;

  let bestMatch = candidates[0];
  let bestDiff = Math.abs(candidates[0].value - targetValue);

  for (const c of candidates) {
    const diff = Math.abs(c.value - targetValue);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = c;
    }
  }

  // Tolérance : l'écart doit être < 5% de la valeur
  if (bestDiff / targetValue > 0.05) return null;
  return { year: bestMatch.year, quarter: bestMatch.quarter };
}

/**
 * Calcule le rattrapage chaîné des révisions manquées.
 * Retourne un preview des étapes sans modifier la BDD.
 */
export async function previewCatchUpRevisions(
  societyId: string,
  leaseId: string
): Promise<ActionResult<CatchUpResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId, status: "EN_COURS" },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };
    if (!lease.indexType || !lease.baseIndexValue) {
      return { success: false, error: "Bail sans indexation ou indice de base manquant. Modifiez le bail pour ajouter un indice de référence." };
    }

    // Déterminer le trimestre de référence et l'année de base
    const baseQInfo = parseBaseIndexQuarter(lease.baseIndexQuarter);
    const preferredQuarter = baseQInfo?.quarter ?? null;

    // Chercher l'indice correspondant à baseIndexValue dans la base
    const baseInfo = await findBaseIndexInfo(
      lease.indexType as IndexType,
      lease.baseIndexValue,
      preferredQuarter
    );

    if (baseInfo) {
      return await buildCatchUpPreview(lease, baseInfo.quarter, baseInfo.year, leaseId);
    }

    // Fallback : utiliser la date de dernière révision ou de début du bail
    const lastRevision = await prisma.rentRevision.findFirst({
      where: { leaseId: lease.id, isValidated: true },
      orderBy: { effectiveDate: "desc" },
    });
    const referenceDate = lastRevision?.effectiveDate ?? lease.startDate;
    const fallbackYear = referenceDate.getFullYear();

    // Déterminer le trimestre : préféré, ou celui avec le plus de données pour ce type
    let fallbackQuarter = preferredQuarter;
    if (!fallbackQuarter) {
      // Prendre le trimestre le plus récent disponible pour ce type d'indice
      const latestAny = await prisma.inseeIndex.findFirst({
        where: { indexType: lease.indexType as IndexType },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
      });
      fallbackQuarter = latestAny?.quarter ?? 1;
    }

    // Vérifier qu'on a des indices après l'année de base
    const anyAfter = await prisma.inseeIndex.findFirst({
      where: { indexType: lease.indexType as IndexType, quarter: fallbackQuarter, year: { gt: fallbackYear } },
    });
    if (!anyAfter) {
      return { success: false, error: `Aucun indice ${lease.indexType} T${fallbackQuarter} disponible après ${fallbackYear}. Synchronisez les indices.` };
    }

    return await buildCatchUpPreview(lease, fallbackQuarter, fallbackYear, leaseId);
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[previewCatchUpRevisions]", error);
    return { success: false, error: "Erreur lors du calcul de rattrapage" };
  }
}

/** Construit le preview de rattrapage chaîné à partir d'une année de base déterminée */
async function buildCatchUpPreview(
  lease: { id: string; indexType: string | null; baseIndexValue: number | null; currentRentHT: number; revisionFrequency: number | null; startDate: Date },
  refQuarter: number,
  baseYear: number,
  leaseId: string
): Promise<ActionResult<CatchUpResult>> {
  if (!lease.indexType || !lease.baseIndexValue) {
    return { success: false, error: "Données du bail incomplètes" };
  }

  // Année cible : la plus récente année pour laquelle on a l'indice du trimestre de référence
  const latestAvailable = await prisma.inseeIndex.findFirst({
    where: { indexType: lease.indexType as IndexType, quarter: refQuarter },
    orderBy: { year: "desc" },
  });
  if (!latestAvailable) {
    return { success: false, error: `Aucun indice ${lease.indexType} T${refQuarter} disponible` };
  }

  const targetYear = latestAvailable.year;
  if (targetYear <= baseYear) {
    return { success: false, error: `L'indice de base est déjà à jour (année ${baseYear}, dernier disponible : ${targetYear})` };
  }

  // Récupérer tous les indices intermédiaires
  const indices = await prisma.inseeIndex.findMany({
    where: {
      indexType: lease.indexType as IndexType,
      quarter: refQuarter,
      year: { gte: baseYear, lte: targetYear },
    },
    orderBy: { year: "asc" },
  });

  // Construire un map année → valeur
  const indexMap = new Map<number, number>();
  for (const idx of indices) indexMap.set(idx.year, idx.value);

  // S'assurer qu'on a l'indice de base
  if (!indexMap.has(baseYear)) {
    indexMap.set(baseYear, lease.baseIndexValue);
  }

  // Chaîner année par année
  const steps: ChainStep[] = [];
  let currentRent = lease.currentRentHT;
  let prevIndex = lease.baseIndexValue;
  const frequency = lease.revisionFrequency ?? 12;

  // Calculer la date d'effet de la première révision manquée
  const lastRevision = await prisma.rentRevision.findFirst({
    where: { leaseId, isValidated: true },
    orderBy: { effectiveDate: "desc" },
  });
  let effectiveDate = new Date(lastRevision?.effectiveDate ?? lease.startDate);

  for (let year = baseYear + 1; year <= targetYear; year++) {
    const yearIndex = indexMap.get(year);
    if (!yearIndex) continue; // Indice manquant pour cette année, on passe

    effectiveDate = new Date(effectiveDate);
    effectiveDate.setMonth(effectiveDate.getMonth() + frequency);

    const newRent = Math.round(currentRent * (yearIndex / prevIndex) * 100) / 100;

    steps.push({
      year,
      quarter: refQuarter,
      fromIndex: prevIndex,
      toIndex: yearIndex,
      rentBefore: currentRent,
      rentAfter: newRent,
      effectiveDate: effectiveDate.toISOString(),
    });

    currentRent = newRent;
    prevIndex = yearIndex;
  }

  if (steps.length === 0) {
    return { success: false, error: `Aucune année de rattrapage trouvée. Indices ${lease.indexType} T${refQuarter} manquants entre ${baseYear + 1} et ${targetYear}.` };
  }

  // Formule résumée
  const lines = steps.map(
    (s) => `${s.rentBefore.toFixed(2)} × (${s.toIndex.toFixed(2)} [T${s.quarter} ${s.year}] / ${s.fromIndex.toFixed(2)}) = ${s.rentAfter.toFixed(2)}`
  );
  const formulaSummary = lines.join("\n");

  return {
    success: true,
    data: {
      steps,
      finalRent: currentRent,
      finalIndexValue: prevIndex,
      formulaSummary,
    },
  };
}

/**
 * Applique le rattrapage chaîné : crée et valide toutes les révisions intermédiaires
 * en une transaction, puis met à jour le bail avec le loyer et l'indice finaux.
 */
export async function applyCatchUpRevisions(
  societyId: string,
  leaseId: string
): Promise<ActionResult<{ finalRent: number; stepsCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // Recalculer le preview pour s'assurer de la cohérence
    const preview = await previewCatchUpRevisions(societyId, leaseId);
    if (!preview.success || !preview.data) return { success: false, error: preview.error ?? "Erreur" };

    const { steps, finalRent, finalIndexValue } = preview.data;

    // Vérifier qu'il n'y a pas de révision en attente
    const existing = await prisma.rentRevision.findFirst({
      where: { leaseId, isValidated: false },
    });
    if (existing) {
      return { success: false, error: "Une révision est déjà en attente. Validez-la ou rejetez-la d'abord." };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
    });
    if (!lease || !lease.indexType) return { success: false, error: "Bail introuvable" };

    // Créer toutes les révisions chaînées + valider + mettre à jour le bail
    await prisma.$transaction(async (tx) => {
      for (const step of steps) {
        const formula = `${step.rentBefore.toFixed(2)} × (${step.toIndex.toFixed(2)} [T${step.quarter} ${step.year}] / ${step.fromIndex.toFixed(2)}) = ${step.rentAfter.toFixed(2)}`;
        await tx.rentRevision.create({
          data: {
            leaseId,
            effectiveDate: new Date(step.effectiveDate),
            previousRentHT: step.rentBefore,
            newRentHT: step.rentAfter,
            indexType: lease.indexType!,
            baseIndexValue: step.fromIndex,
            newIndexValue: step.toIndex,
            formula,
            isValidated: true,
            validatedAt: new Date(),
            validatedBy: session.user!.id,
          },
        });
      }

      // Mettre à jour le bail avec les valeurs finales + le trimestre de référence
      const lastStep = steps[steps.length - 1];
      await tx.lease.update({
        where: { id: leaseId },
        data: {
          currentRentHT: finalRent,
          baseIndexValue: finalIndexValue,
          baseIndexQuarter: `T${lastStep.quarter} ${lastStep.year}`,
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "RentRevision",
      entityId: leaseId,
      details: {
        action: "catch_up",
        stepsCount: steps.length,
        originalRent: steps[0].rentBefore,
        finalRent,
        originalIndex: steps[0].fromIndex,
        finalIndex: finalIndexValue,
      },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${leaseId}`);
    revalidatePath("/indices");

    return { success: true, data: { finalRent, stepsCount: steps.length } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[applyCatchUpRevisions]", error);
    return { success: false, error: "Erreur lors de l'application du rattrapage" };
  }
}
