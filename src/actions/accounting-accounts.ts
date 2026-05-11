"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  getAccountingJournalTypeAliases,
  isAccountingJournalType,
} from "@/lib/accounting-journals";
import type {
  AccountRow,
  AccountingDocumentOption,
  FrequentAccountRow,
} from "@/actions/accounting-shared";

// ─── Comptes ──────────────────────────────────────────────────────────────────

export async function getAccounts(societyId: string): Promise<ActionResult<AccountRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const accounts = await prisma.accountingAccount.findMany({
      where: { societyId, isActive: true },
      select: { id: true, code: true, label: true, type: true },
      orderBy: { code: "asc" },
    });

    return { success: true, data: accounts };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getAccounts]", error);
    return { success: false, error: "Erreur lors de la récupération des comptes" };
  }
}

export async function getAccountingDocumentOptions(societyId: string): Promise<ActionResult<AccountingDocumentOption[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const documents = await prisma.document.findMany({
      where: { societyId, deletedAt: null },
      select: { id: true, fileName: true, category: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return { success: true, data: documents };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getAccountingDocumentOptions]", error);
    return { success: false, error: "Erreur lors de la récupération des pièces GED" };
  }
}

export async function getFrequentAccountsForJournal(
  societyId: string,
  journalType: string,
  limit = 8
): Promise<ActionResult<FrequentAccountRow[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!isAccountingJournalType(journalType)) {
      return { success: false, error: "Journal comptable non supporté" };
    }

    const aliases = getAccountingJournalTypeAliases(journalType);
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: { societyId, isActive: true },
        journalEntry: {
          societyId,
          journalType: { in: aliases as never },
        },
      },
      select: {
        accountId: true,
        account: { select: { id: true, code: true, label: true, type: true } },
        journalEntry: { select: { entryDate: true } },
      },
      orderBy: { journalEntry: { entryDate: "desc" } },
      take: 200,
    });

    const byAccount = new Map<string, FrequentAccountRow>();
    for (const line of lines) {
      const existing = byAccount.get(line.accountId);
      if (existing) {
        existing.usageCount += 1;
        if (line.journalEntry.entryDate > existing.lastUsedAt) existing.lastUsedAt = line.journalEntry.entryDate;
        continue;
      }
      byAccount.set(line.accountId, {
        ...line.account,
        usageCount: 1,
        lastUsedAt: line.journalEntry.entryDate,
      });
    }

    return {
      success: true,
      data: [...byAccount.values()]
        .sort((a, b) => b.usageCount - a.usageCount || b.lastUsedAt.getTime() - a.lastUsedAt.getTime() || a.code.localeCompare(b.code))
        .slice(0, Math.max(1, Math.min(limit, 20))),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getFrequentAccountsForJournal]", error);
    return { success: false, error: "Erreur lors de la récupération des comptes fréquents" };
  }
}
