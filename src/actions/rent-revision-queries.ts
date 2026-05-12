"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import type { IndexType, LeaseType } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  calculateNewRent,
  parseBaseIndexQuarter,
  isHabitationLeaseType,
  isRecoverableHabitationRevision,
  getNextRevisionDate,
  getMissedRevisionsCount,
  getRevisionStatus,
  findClosestIndex,
  getLatestIndex,
  getIndexForReferenceQuarter,
} from "@/actions/rent-revision-shared";
import type {
  ChainStep,
  CatchUpResult,
  LeaseIndexationOverview,
} from "@/actions/rent-revision-shared";

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
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[getPendingRevisions]", error);
    return {
      success: false,
      error: "Erreur lors de la récupération des révisions",
    };
  }
}


export async function getLeaseIndexationOverview(
  societyId: string,
  leaseId: string
): Promise<ActionResult<LeaseIndexationOverview>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId, deletedAt: null },
      select: {
        id: true,
        leaseType: true,
        status: true,
        startDate: true,
        entryDate: true,
        currentRentHT: true,
        indexType: true,
        baseIndexValue: true,
        baseIndexQuarter: true,
        revisionFrequency: true,
        revisionDateBasis: true,
        revisionCustomMonth: true,
        revisionCustomDay: true,
        rentRevisions: {
          orderBy: { effectiveDate: "desc" },
          take: 20,
          select: {
            id: true,
            effectiveDate: true,
            newRentHT: true,
            newIndexValue: true,
            isValidated: true,
            formula: true,
          },
        },
      },
    });

    if (!lease) return { success: false, error: "Bail introuvable" };

    const baseOverview = {
      isIndexed: Boolean(lease.indexType),
      indexType: lease.indexType,
      currentRentHT: lease.currentRentHT,
      baseIndexValue: lease.baseIndexValue,
      baseIndexQuarter: lease.baseIndexQuarter,
      revisionFrequency: lease.revisionFrequency ?? 12,
      nextRevisionDate: null,
      statusLabel: lease.indexType ? "À vérifier" : "Sans indexation",
      statusVariant: lease.indexType ? "secondary" : "outline",
      missedRevisions: 0,
      pendingRevision: null,
      lastValidatedRevisionDate: null,
      referenceIndexValue: null,
      referenceIndexQuarter: null,
      referenceIndexYear: null,
      estimatedNewRentHT: null,
      formula: null,
      canGenerateRevision: false,
      canCatchUp: false,
      blockReason: lease.indexType ? null : "Aucune clause d'indexation n'est configurée sur ce bail.",
      legalNote: isHabitationLeaseType(lease.leaseType)
        ? "Bail d'habitation : une révision oubliée depuis plus d'un an n'est pas récupérable."
        : null,
    } satisfies LeaseIndexationOverview;

    if (!lease.indexType) return { success: true, data: baseOverview };
    if (!lease.baseIndexValue) {
      return {
        success: true,
        data: {
          ...baseOverview,
          blockReason: "Indice de référence manquant : complétez le bail avant de calculer une révision.",
        },
      };
    }

    const lastValidated = lease.rentRevisions.find((r) => r.isValidated);
    const pendingRevision = lease.rentRevisions.find((r) => !r.isValidated);
    const revisionFrequency = lease.revisionFrequency ?? 12;
    const nextRevisionDate = getNextRevisionDate(
      lease.startDate,
      revisionFrequency,
      lastValidated?.effectiveDate,
      lease.entryDate,
      lease.revisionDateBasis,
      lease.revisionCustomMonth,
      lease.revisionCustomDay,
    );
    const missedRevisions = getMissedRevisionsCount(
      lease.startDate,
      revisionFrequency,
      lastValidated?.effectiveDate,
      lease.entryDate,
      lease.revisionDateBasis,
      lease.revisionCustomMonth,
      lease.revisionCustomDay,
    );
    const status = getRevisionStatus(nextRevisionDate);

    const baseQuarter = parseBaseIndexQuarter(lease.baseIndexQuarter);
    let referenceIndex: { value: number; year: number; quarter: number } | null = null;
    if (baseQuarter) {
      referenceIndex =
        (await getIndexForReferenceQuarter(lease.indexType, baseQuarter.quarter, nextRevisionDate.getFullYear())) ??
        (await getIndexForReferenceQuarter(lease.indexType, baseQuarter.quarter, nextRevisionDate.getFullYear() - 1));
    }
    referenceIndex ??= await getLatestIndex(lease.indexType);

    const estimatedNewRentHT = referenceIndex
      ? calculateNewRent(lease.currentRentHT, lease.baseIndexValue, referenceIndex.value, lease.indexType)
      : null;
    const referenceLabel = referenceIndex ? `T${referenceIndex.quarter} ${referenceIndex.year}` : null;
    const formula =
      referenceIndex && estimatedNewRentHT !== null
        ? `${lease.currentRentHT.toFixed(2)} × (${referenceIndex.value} [${referenceLabel}] / ${lease.baseIndexValue}) = ${estimatedNewRentHT.toFixed(2)}`
        : null;

    const blockReason = !referenceIndex
      ? `Aucun indice ${lease.indexType} disponible. Synchronisez les indices INSEE.`
      : pendingRevision
        ? "Une révision est déjà en attente de validation."
        : null;

    return {
      success: true,
      data: {
        ...baseOverview,
        nextRevisionDate: nextRevisionDate.toISOString(),
        statusLabel: pendingRevision ? "Révision en attente" : status.label,
        statusVariant: pendingRevision ? "warning" : status.variant,
        missedRevisions,
        pendingRevision: pendingRevision
          ? {
              id: pendingRevision.id,
              effectiveDate: pendingRevision.effectiveDate.toISOString(),
              newRentHT: pendingRevision.newRentHT,
              formula: pendingRevision.formula,
            }
          : null,
        lastValidatedRevisionDate: lastValidated?.effectiveDate.toISOString() ?? null,
        referenceIndexValue: referenceIndex?.value ?? null,
        referenceIndexQuarter: referenceIndex ? `T${referenceIndex.quarter}` : null,
        referenceIndexYear: referenceIndex?.year ?? null,
        estimatedNewRentHT,
        formula,
        canGenerateRevision: !pendingRevision && missedRevisions > 0 && missedRevisions <= 1 && Boolean(referenceIndex),
        canCatchUp: !pendingRevision && missedRevisions > 1,
        blockReason,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getLeaseIndexationOverview]", error);
    return { success: false, error: "Erreur lors de la récupération de l'indexation" };
  }
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


export async function previewCatchUpRevisions(
  societyId: string,
  leaseId: string
): Promise<ActionResult<CatchUpResult>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[previewCatchUpRevisions]", error);
    return { success: false, error: "Erreur lors du calcul de rattrapage" };
  }
}

/** Construit le preview de rattrapage chaîné à partir d'une année de base déterminée */
async function buildCatchUpPreview(
  lease: { id: string; indexType: string | null; baseIndexValue: number | null; currentRentHT: number; revisionFrequency: number | null; startDate: Date; leaseType?: LeaseType | string | null },
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

  // Chaîner année par année. Pour les baux d'habitation, les révisions
  // demandées plus d'un an après leur date d'effet sont perdues : on ne
  // les capitalise pas dans le loyer.
  const steps: ChainStep[] = [];
  let currentRent = lease.currentRentHT;
  let prevIndex = lease.baseIndexValue;
  const frequency = lease.revisionFrequency ?? 12;
  const isHabitation = isHabitationLeaseType(lease.leaseType);
  let expiredHabitationSteps = 0;

  // Calculer la date d'effet de la première révision manquée
  const lastRevision = await prisma.rentRevision.findFirst({
    where: { leaseId, isValidated: true },
    orderBy: { effectiveDate: "desc" },
  });
  let effectiveDate = new Date(lastRevision?.effectiveDate ?? lease.startDate);

  // Avancer la date d'effet jusqu'à la dernière occurrence AVANT l'année
  // de la première révision manquée, pour que les dates correspondent
  // aux années d'indices (et non à un décalage depuis la date du bail)
  const firstCatchUpYear = baseYear + 1;
  while (true) {
    const next = new Date(effectiveDate);
    next.setMonth(next.getMonth() + frequency);
    if (next.getFullYear() >= firstCatchUpYear) break;
    effectiveDate = next;
  }

  for (let year = baseYear + 1; year <= targetYear; year++) {
    const yearIndex = indexMap.get(year);
    if (!yearIndex) continue; // Indice manquant pour cette année, on passe

    effectiveDate = new Date(effectiveDate);
    effectiveDate.setMonth(effectiveDate.getMonth() + frequency);

    if (isHabitation) {
      if (!isRecoverableHabitationRevision(effectiveDate)) {
        expiredHabitationSteps++;
        prevIndex = yearIndex;
        continue;
      }

      const previousAnnualIndex = indexMap.get(year - 1);
      if (!previousAnnualIndex) continue;
      prevIndex = previousAnnualIndex;
    }

    const newRent = calculateNewRent(currentRent, prevIndex, yearIndex, lease.indexType ?? undefined);

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
    if (isHabitation && expiredHabitationSteps > 0) {
      return {
        success: false,
        error: `Aucune révision d'habitation récupérable : ${expiredHabitationSteps} révision(s) dépassent le délai légal d'un an et ne doivent pas être rattrapées.`,
      };
    }
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
