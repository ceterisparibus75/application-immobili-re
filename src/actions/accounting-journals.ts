"use server";

import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const JOURNAL_LABELS: Record<string, string> = {
  VENTES: "Ventes",
  BANQUE: "Banque",
  OPERATIONS_DIVERSES: "Opérations diverses",
  AN: "À-nouveaux",
  AC: "Achats",
  BQUE: "Banque",
  INV: "Investissements",
  OD: "Opérations diverses",
  VT: "Ventes / TVA",
};

export type JournalSummaryFilters = {
  fiscalYearId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type JournalSummaryRow = {
  journalType: string;
  journalLabel: string;
  entryCount: number;
  lineCount: number;
  draftCount: number;
  validatedCount: number;
  closedCount: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  firstEntryDate: Date | null;
  lastEntryDate: Date | null;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function updateRange(
  current: { firstEntryDate: Date | null; lastEntryDate: Date | null },
  entryDate: Date
): void {
  if (!current.firstEntryDate || entryDate < current.firstEntryDate) current.firstEntryDate = entryDate;
  if (!current.lastEntryDate || entryDate > current.lastEntryDate) current.lastEntryDate = entryDate;
}

export async function getJournalSummary(
  societyId: string,
  filters: JournalSummaryFilters = {}
): Promise<ActionResult<JournalSummaryRow[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const where: Record<string, unknown> = { societyId };
    if (filters.fiscalYearId) {
      const fiscalYear = await prisma.fiscalYear.findFirst({
        where: { id: filters.fiscalYearId, societyId },
        select: { startDate: true, endDate: true },
      });
      if (!fiscalYear) return { success: false, error: "Exercice introuvable" };
      where.entryDate = { gte: fiscalYear.startDate, lte: fiscalYear.endDate };
    } else if (filters.dateFrom || filters.dateTo) {
      where.entryDate = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      select: {
        journalType: true,
        entryDate: true,
        status: true,
        lines: { select: { debit: true, credit: true } },
      },
      orderBy: [{ journalType: "asc" }, { entryDate: "asc" }],
    });

    const byJournal = new Map<string, JournalSummaryRow>();
    for (const entry of entries) {
      const key = entry.journalType;
      const row = byJournal.get(key) ?? {
        journalType: key,
        journalLabel: JOURNAL_LABELS[key] ?? key,
        entryCount: 0,
        lineCount: 0,
        draftCount: 0,
        validatedCount: 0,
        closedCount: 0,
        totalDebit: 0,
        totalCredit: 0,
        balanced: true,
        firstEntryDate: null,
        lastEntryDate: null,
      };

      row.entryCount += 1;
      row.lineCount += entry.lines.length;
      if (entry.status === "BROUILLON") row.draftCount += 1;
      if (entry.status === "VALIDEE") row.validatedCount += 1;
      if (entry.status === "CLOTUREE") row.closedCount += 1;
      row.totalDebit = roundCents(row.totalDebit + entry.lines.reduce((sum, line) => sum + line.debit, 0));
      row.totalCredit = roundCents(row.totalCredit + entry.lines.reduce((sum, line) => sum + line.credit, 0));
      row.balanced = Math.abs(row.totalDebit - row.totalCredit) <= 0.01;
      updateRange(row, entry.entryDate);
      byJournal.set(key, row);
    }

    return {
      success: true,
      data: [...byJournal.values()].sort((a, b) => a.journalType.localeCompare(b.journalType)),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getJournalSummary]", error);
    return { success: false, error: "Erreur lors du calcul des journaux" };
  }
}
