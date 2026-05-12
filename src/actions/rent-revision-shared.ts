// Helpers de calcul et constantes pour les révisions de loyer — pas de "use server".

import { prisma } from "@/lib/prisma";
import type { IndexType, LeaseType } from "@/generated/prisma/client";

export const INDEX_ALERT_THRESHOLD_PCT: Record<string, number> = {
  IRL: 10,   // IRL varie rarement au-delà de 5-6% par an hors période exceptionnelle
  ILC: 15,   // ILC suit davantage l'inflation des commerces
  ILAT: 15,  // ILAT similaire à ILC
  ICC: 20,   // ICC (coût construction) peut varier plus fortement
};

export const HABITATION_LEASE_TYPES: ReadonlySet<LeaseType> = new Set([
  "HABITATION",
  "MEUBLE",
  "ETUDIANT",
  "MOBILITE",
  "COLOCATION",
]);

export function isHabitationLeaseType(leaseType: LeaseType | string | null | undefined): boolean {
  return Boolean(leaseType && HABITATION_LEASE_TYPES.has(leaseType as LeaseType));
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function isRecoverableHabitationRevision(effectiveDate: Date, today = new Date()): boolean {
  return effectiveDate <= today && addYears(effectiveDate, 1) >= today;
}

export function calculateNewRent(
  currentRentHT: number,
  baseIndexValue: number,
  newIndexValue: number,
  indexType?: string
): number {
  if (baseIndexValue <= 0) return currentRentHT;
  const newRent = currentRentHT * (newIndexValue / baseIndexValue);
  const rounded = Math.round(newRent * 100) / 100;

  // Guard anti-données-aberrantes : variation max ±50% sur une révision
  const maxRent = currentRentHT * 1.5;
  const minRent = Math.max(1, currentRentHT * 0.5);
  if (rounded > maxRent || rounded < minRent) {
    console.error(
      `[calculateNewRent] Variation anormale (>${50}%) — type: ${indexType ?? "?"}, loyer actuel: ${currentRentHT}, calculé: ${rounded}. Plafonné.`
    );
    return rounded > maxRent ? Math.round(maxRent * 100) / 100 : Math.round(minRent * 100) / 100;
  }

  // Alerte métier : variation au-delà du seuil habituel pour ce type d'indice
  const alertPct = indexType ? (INDEX_ALERT_THRESHOLD_PCT[indexType] ?? 20) : 20;
  const variationPct = ((newIndexValue - baseIndexValue) / baseIndexValue) * 100;
  if (Math.abs(variationPct) > alertPct) {
    console.error(
      `[calculateNewRent] Alerte variation ${indexType ?? "indice"} inhabituelle : ${variationPct.toFixed(2)}% (seuil alerte: ${alertPct}%). Vérifier la cohérence des indices INSEE.`
    );
  }

  return rounded;
}

export async function getLatestIndex(indexType: IndexType): Promise<{
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
export async function getIndexForReferenceQuarter(
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
export function parseBaseIndexQuarter(baseIndexQuarter: string | null): { quarter: number; year: number } | null {
  if (!baseIndexQuarter) return null;
  const match = baseIndexQuarter.match(/T(\d)\s*(\d{4})/);
  if (!match) return null;
  return { quarter: parseInt(match[1]), year: parseInt(match[2]) };
}


export function getRevisionAnchorDate(
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

export function getNextRevisionDate(
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

export interface LeaseIndexationOverview {
  isIndexed: boolean;
  indexType: IndexType | null;
  currentRentHT: number;
  baseIndexValue: number | null;
  baseIndexQuarter: string | null;
  revisionFrequency: number | null;
  nextRevisionDate: string | null;
  statusLabel: string;
  statusVariant: "destructive" | "warning" | "default" | "secondary" | "outline";
  missedRevisions: number;
  pendingRevision: {
    id: string;
    effectiveDate: string;
    newRentHT: number;
    formula: string | null;
  } | null;
  lastValidatedRevisionDate: string | null;
  referenceIndexValue: number | null;
  referenceIndexQuarter: string | null;
  referenceIndexYear: number | null;
  estimatedNewRentHT: number | null;
  formula: string | null;
  canGenerateRevision: boolean;
  canCatchUp: boolean;
  blockReason: string | null;
  legalNote: string | null;
}

export function getMissedRevisionsCount(
  startDate: Date,
  revisionFrequency: number,
  lastRevisionDate?: Date | null,
  entryDate?: Date | null,
  revisionDateBasis?: string | null,
  customMonth?: number | null,
  customDay?: number | null,
): number {
  const now = new Date();
  const nextDate = getNextRevisionDate(
    startDate,
    revisionFrequency,
    lastRevisionDate ?? undefined,
    entryDate,
    revisionDateBasis,
    customMonth,
    customDay,
  );
  if (nextDate > now) return 0;

  let count = 0;
  const cursor = new Date(nextDate);
  while (cursor <= now) {
    count++;
    cursor.setMonth(cursor.getMonth() + revisionFrequency);
  }
  return count;
}

export function getRevisionStatus(nextDate: Date): {
  label: string;
  variant: "destructive" | "warning" | "default" | "secondary";
} {
  const now = new Date();
  const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `En retard de ${Math.abs(diffDays)} j`, variant: "destructive" };
  if (diffDays <= 30) return { label: `Dans ${diffDays} j`, variant: "warning" };
  if (diffDays <= 90) return { label: `Dans ${diffDays} j`, variant: "secondary" };
  return { label: `Dans ${diffDays} j`, variant: "default" };
}

export function findClosestIndex(
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
