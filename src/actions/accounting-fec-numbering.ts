"use server";

/**
 * Numerotation FEC — persistance de l'EcritureNum sur JournalEntry.
 *
 * Contexte reglementaire : l'article 54 du CGI (+ art. A.47 A-1 LPF) exige
 * l'inalterabilite des ecritures d'un exercice clos. Deux exports FEC
 * successifs du meme exercice doivent produire STRICTEMENT le meme fichier
 * (meme ordre, memes EcritureNum). L'ancienne implementation calculait
 * EcritureNum a la volee via un compteur reinitialise, ce qui violait cette
 * exigence des que l'ordre naturel des entries changeait (ex. insertion a
 * posteriori d'une ecriture backdatee).
 *
 * Format retenu : chaine numerique zero-paddee sur 8 chiffres, sequentielle
 * par exercice (fiscalYearId) sans trou, ordonnee par
 * (entryDate ASC, createdAt ASC). Un seul compteur unique par exercice —
 * recommandation usuelle DGFiP (pas un compteur par journal, qui est plus
 * une convention Sage historique).
 */

import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { createAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const FEC_NUM_WIDTH = 8;

export function formatFecEcritureNum(sequence: number): string {
  return String(sequence).padStart(FEC_NUM_WIDTH, "0");
}

export interface AssignFecNumbersResult {
  fiscalYearId: string;
  year: number;
  assigned: number;
  skipped: number;
  alreadyNumbered: boolean;
}

/**
 * Attribue (ou re-attribue si `force=true`) un fecEcritureNum sequentiel a
 * toutes les JournalEntry de l'exercice.
 *
 * Idempotent : si toutes les ecritures sont deja numerotees et `force` est
 * false, ne fait rien.
 *
 * @param societyId  identifiant de la societe (verifie par requireSocietyActionContext)
 * @param fiscalYearId identifiant de l'exercice fiscal
 * @param options
 *   - force : si true, re-attribue les numeros meme si deja presents.
 *     ⚠️ A reserver aux cas exceptionnels (correctif admin) avant cloture,
 *     car cela casse l'inalterabilite si l'exercice est clos.
 */
export async function assignFecNumbersToFiscalYear(
  societyId: string,
  fiscalYearId: string,
  options: { force?: boolean } = {}
): Promise<ActionResult<AssignFecNumbersResult>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, societyId },
      select: { id: true, year: true },
    });
    if (!fiscalYear) {
      return { success: false, error: "Exercice fiscal introuvable pour cette société" };
    }

    // On ne numerote QUE les ecritures validees (BROUILLON exclus) : un
    // brouillon n'a pas vocation a figurer dans un FEC definitif.
    const entries = await prisma.journalEntry.findMany({
      where: { societyId, fiscalYearId, isValidated: true },
      select: { id: true, fecEcritureNum: true },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    });

    if (entries.length === 0) {
      return {
        success: true,
        data: {
          fiscalYearId,
          year: fiscalYear.year,
          assigned: 0,
          skipped: 0,
          alreadyNumbered: false,
        },
      };
    }

    const alreadyNumberedCount = entries.filter((e) => e.fecEcritureNum !== null).length;
    const allAlready = alreadyNumberedCount === entries.length;

    if (allAlready && !options.force) {
      return {
        success: true,
        data: {
          fiscalYearId,
          year: fiscalYear.year,
          assigned: 0,
          skipped: entries.length,
          alreadyNumbered: true,
        },
      };
    }

    if (alreadyNumberedCount > 0 && !options.force) {
      return {
        success: false,
        error: `Numérotation partielle détectée (${alreadyNumberedCount}/${entries.length} déjà numérotées). Passez force=true pour re-attribuer entièrement.`,
      };
    }

    // UPDATE en 1 transaction, séquence 1..N
    await prisma.$transaction(
      entries.map((entry, idx) =>
        prisma.journalEntry.update({
          where: { id: entry.id },
          data: { fecEcritureNum: formatFecEcritureNum(idx + 1) },
        })
      )
    );

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "FiscalYear",
      entityId: fiscalYearId,
      details: {
        action: "ASSIGN_FEC_NUMBERS",
        year: fiscalYear.year,
        count: entries.length,
        force: Boolean(options.force),
      },
    });

    return {
      success: true,
      data: {
        fiscalYearId,
        year: fiscalYear.year,
        assigned: entries.length,
        skipped: 0,
        alreadyNumbered: false,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[assignFecNumbersToFiscalYear]", error);
    return { success: false, error: "Erreur lors de l'attribution des numéros FEC" };
  }
}
