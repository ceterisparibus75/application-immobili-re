"use server";

/**
 * Résolution manuelle des JournalEntry orphelines (fiscalYearId NULL).
 *
 * Contexte : la migration 20261007200000_journal_entry_fiscal_year_backfill
 * rattache automatiquement les écritures orphelines au FiscalYear qui couvre
 * leur entryDate. Il reste des cas où aucun exercice n'existe pour une date
 * donnée (ex: écritures historiques pré-création de l'exercice correspondant).
 *
 * Cette action admin permet soit de rattacher les orphelines à un FiscalYear
 * existant choisi explicitement, soit de créer un nouvel exercice couvrant
 * la plage [date min, date max] des orphelines d'une société.
 *
 * Rôle requis : ADMIN_SOCIETE (par société), SUPER_ADMIN voit toutes les
 * sociétés accessibles.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireAuthenticatedActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-auth";
import { requireSocietyActionContext } from "@/lib/action-society";

export type OrphanEntry = {
  id: string;
  entryDate: Date;
  journalType: string;
  piece: string | null;
  label: string;
};

export type OrphanGroup = {
  societyId: string;
  societyName: string;
  count: number;
  minDate: Date;
  maxDate: Date;
  entries: OrphanEntry[];
};

/**
 * Liste les orphelines groupées par société. Un ADMIN_SOCIETE ne voit que sa
 * société ; un SUPER_ADMIN voit toutes celles où il a au moins un accès.
 */
export async function listOrphanJournalEntries(): Promise<ActionResult<OrphanGroup[]>> {
  try {
    const context = await requireAuthenticatedActionContext();

    // Sociétés accessibles au user (filtre scope). On ne liste QUE celles où
    // il est au moins ADMIN_SOCIETE — pas de leak inter-société.
    const memberships = await prisma.userSociety.findMany({
      where: {
        userId: context.userId,
        role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE"] },
      },
      select: { societyId: true },
    });
    const allowedSocietyIds = memberships.map((m) => m.societyId);
    if (allowedSocietyIds.length === 0) {
      return { success: true, data: [] };
    }

    const orphans = await prisma.journalEntry.findMany({
      where: {
        fiscalYearId: null,
        societyId: { in: allowedSocietyIds },
      },
      select: {
        id: true,
        societyId: true,
        entryDate: true,
        journalType: true,
        piece: true,
        label: true,
        society: { select: { name: true } },
      },
      orderBy: [{ societyId: "asc" }, { entryDate: "asc" }],
      take: 2000, // garde-fou mémoire — 239 orphelines connues, large marge
    });

    const groups = new Map<string, OrphanGroup>();
    for (const o of orphans) {
      const existing = groups.get(o.societyId);
      const entry: OrphanEntry = {
        id: o.id,
        entryDate: o.entryDate,
        journalType: o.journalType,
        piece: o.piece,
        label: o.label,
      };
      if (existing) {
        existing.entries.push(entry);
        existing.count += 1;
        if (o.entryDate < existing.minDate) existing.minDate = o.entryDate;
        if (o.entryDate > existing.maxDate) existing.maxDate = o.entryDate;
      } else {
        groups.set(o.societyId, {
          societyId: o.societyId,
          societyName: o.society?.name ?? "—",
          count: 1,
          minDate: o.entryDate,
          maxDate: o.entryDate,
          entries: [entry],
        });
      }
    }

    return { success: true, data: Array.from(groups.values()) };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[listOrphanJournalEntries]", error);
    return { success: false, error: "Erreur lors du chargement des orphelines" };
  }
}

/**
 * Rattache toutes les orphelines d'une société à un FiscalYear existant.
 * Ne modifie que les orphelines (fiscalYearId NULL) — pas de risque de
 * ré-affecter des écritures déjà rattachées.
 */
export async function attachOrphansToFiscalYear(
  societyId: string,
  fiscalYearId: string,
): Promise<ActionResult<{ updated: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const fy = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, societyId },
      select: { id: true, year: true, isClosed: true },
    });
    if (!fy) return { success: false, error: "Exercice introuvable pour cette société" };
    if (fy.isClosed) {
      return {
        success: false,
        error: "Impossible de rattacher à un exercice clos. Choisissez un exercice ouvert.",
      };
    }

    const result = await prisma.journalEntry.updateMany({
      where: { societyId, fiscalYearId: null },
      data: { fiscalYearId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: fiscalYearId,
      details: {
        action: "attach_orphans_to_fiscal_year",
        fiscalYearId,
        fiscalYear: fy.year,
        count: result.count,
      },
    });

    revalidatePath("/comptabilite/orphelines");
    revalidatePath("/comptabilite");
    return { success: true, data: { updated: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[attachOrphansToFiscalYear]", error);
    return { success: false, error: "Erreur lors du rattachement" };
  }
}

/**
 * Crée un nouveau FiscalYear qui couvre la plage [date min, date max] des
 * orphelines d'une société, puis les rattache à ce nouvel exercice.
 *
 * Le "year" du FiscalYear est l'année de la date min — si ça entre en conflit
 * avec un exercice existant (contrainte @@unique societyId+year), on retourne
 * une erreur explicite demandant à l'admin de choisir "attacher à l'existant".
 */
export async function createCoveringFiscalYearAndAttach(
  societyId: string,
): Promise<ActionResult<{ fiscalYearId: string; year: number; attached: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const bounds = await prisma.journalEntry.aggregate({
      where: { societyId, fiscalYearId: null },
      _min: { entryDate: true },
      _max: { entryDate: true },
      _count: true,
    });
    if (bounds._count === 0 || !bounds._min.entryDate || !bounds._max.entryDate) {
      return { success: false, error: "Aucune orpheline à rattacher pour cette société" };
    }

    const minDate = bounds._min.entryDate;
    const maxDate = bounds._max.entryDate;
    const year = minDate.getFullYear();

    // Évite les conflits avec les exercices existants qui couvrent déjà
    // partiellement la plage. On refuse plutôt que créer un chevauchement.
    const conflicting = await prisma.fiscalYear.findFirst({
      where: {
        societyId,
        OR: [
          { year },
          {
            AND: [
              { startDate: { lte: maxDate } },
              { endDate: { gte: minDate } },
            ],
          },
        ],
      },
      select: { id: true, year: true },
    });
    if (conflicting) {
      return {
        success: false,
        error: `Un exercice existant (${conflicting.year}) couvre déjà cette plage. Utilisez « Rattacher à un exercice existant » plutôt que d'en créer un nouveau.`,
      };
    }

    // Calcule des bornes propres : premier janvier → 31 décembre de l'année
    // de la date min, en élargissant si maxDate dépasse (cas rare mais
    // possible si les orphelines s'étalent sur plusieurs années).
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(Math.max(year, maxDate.getFullYear()), 11, 31, 23, 59, 59));

    const result = await prisma.$transaction(async (tx) => {
      const fy = await tx.fiscalYear.create({
        data: { societyId, year, startDate, endDate },
      });
      const updated = await tx.journalEntry.updateMany({
        where: { societyId, fiscalYearId: null },
        data: { fiscalYearId: fy.id },
      });
      return { fy, updated: updated.count };
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "FiscalYear",
      entityId: result.fy.id,
      details: {
        action: "create_covering_fy_and_attach",
        year,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        orphansAttached: result.updated,
      },
    });

    revalidatePath("/comptabilite/orphelines");
    revalidatePath("/comptabilite");
    return { success: true, data: { fiscalYearId: result.fy.id, year, attached: result.updated } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createCoveringFiscalYearAndAttach]", error);
    return { success: false, error: "Erreur lors de la création de l'exercice couvrant" };
  }
}

/**
 * Liste les FiscalYear ouverts d'une société (pour le select de l'UI).
 */
export async function listOpenFiscalYears(
  societyId: string,
): Promise<ActionResult<Array<{ id: string; year: number; startDate: Date; endDate: Date }>>> {
  try {
    await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const years = await prisma.fiscalYear.findMany({
      where: { societyId, isClosed: false },
      select: { id: true, year: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    });
    return { success: true, data: years };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[listOpenFiscalYears]", error);
    return { success: false, error: "Erreur lors du chargement des exercices" };
  }
}
