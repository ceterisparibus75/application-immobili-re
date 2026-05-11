"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import type { JournalType, Prisma } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  getAccountingJournalTypeAliases,
  isAccountingJournalType,
} from "@/lib/accounting-journals";
import { roundCents, type BalanceRow, type GrandLivreRow } from "@/actions/accounting-shared";

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function getBalance(
  societyId: string,
  filters: { fiscalYearId?: string; classe?: string; dateFrom?: string; dateTo?: string }
): Promise<ActionResult<BalanceRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: {
          societyId,
          ...(filters.classe ? { type: filters.classe } : {}),
        },
        journalEntry: {
          ...(filters.fiscalYearId ? { fiscalYearId: filters.fiscalYearId } : {}),
          ...(filters.dateFrom ? { entryDate: { gte: new Date(filters.dateFrom) } } : {}),
          ...(filters.dateTo
            ? { entryDate: { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), lte: new Date(filters.dateTo) } }
            : {}),
        },
      },
      select: {
        debit: true,
        credit: true,
        account: { select: { id: true, code: true, label: true, type: true } },
      },
    });

    // Agréger par compte
    const map = new Map<string, BalanceRow>();
    for (const line of lines) {
      const key = line.account.id;
      if (!map.has(key)) {
        map.set(key, {
          accountId: line.account.id,
          code: line.account.code,
          label: line.account.label,
          classe: line.account.type,
          totalDebit: 0,
          totalCredit: 0,
          soldeDebiteur: 0,
          soldeCrediteur: 0,
        });
      }
      const b = map.get(key)!;
      b.totalDebit += line.debit;
      b.totalCredit += line.credit;
    }

    const data: BalanceRow[] = [...map.values()].map((b) => {
      const diff = b.totalDebit - b.totalCredit;
      return {
        ...b,
        soldeDebiteur: diff > 0 ? diff : 0,
        soldeCrediteur: diff < 0 ? -diff : 0,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));

    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getBalance]", error);
    return { success: false, error: "Erreur lors du calcul de la balance" };
  }
}

// ─── Grand Livre ──────────────────────────────────────────────────────────────

export async function getGrandLivre(
  societyId: string,
  filters: {
    accountId?: string;
    fiscalYearId?: string;
    journalType?: string;
    dateFrom?: string;
    dateTo?: string;
    nonLettered?: boolean;
    letteringStatus?: "all" | "lettered" | "unlettered";
    letteringCode?: string;
  }
): Promise<ActionResult<GrandLivreRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    if (filters.journalType && !isAccountingJournalType(filters.journalType)) {
      return { success: false, error: "Journal comptable non supporté" };
    }

    const journalTypeFilter: Prisma.JournalEntryWhereInput["journalType"] | undefined = filters.journalType
      ? isAccountingJournalType(filters.journalType)
        ? { in: getAccountingJournalTypeAliases(filters.journalType) as JournalType[] }
        : filters.journalType as JournalType
      : undefined;
    const journalEntryWhere: Prisma.JournalEntryWhereInput = {
      ...(filters.fiscalYearId ? { fiscalYearId: filters.fiscalYearId } : {}),
      ...(journalTypeFilter ? { journalType: journalTypeFilter } : {}),
      ...(filters.dateFrom ? { entryDate: { gte: new Date(filters.dateFrom) } } : {}),
      ...(filters.dateTo
        ? { entryDate: { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), lte: new Date(filters.dateTo) } }
        : {}),
    };
    const letteringCode = filters.letteringCode?.trim() || undefined;
    const letteringFilter: Prisma.JournalEntryLineWhereInput =
      letteringCode
        ? { OR: [{ letteringCode }, { lettrage: letteringCode }] }
        : filters.nonLettered || filters.letteringStatus === "unlettered"
          ? { letteringCode: null, lettrage: null }
          : filters.letteringStatus === "lettered"
            ? { OR: [{ letteringCode: { not: null } }, { lettrage: { not: null } }] }
            : {};

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...letteringFilter,
        account: { societyId },
        journalEntry: journalEntryWhere,
      },
      include: {
        account: { select: { code: true, label: true } },
        journalEntry: {
          select: { entryDate: true, piece: true, journalType: true, label: true, status: true },
        },
      },
      orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
    });

    // Calcul du solde cumulé indépendant par compte.
    const soldesByAccount = new Map<string, number>();
    const data: GrandLivreRow[] = lines.map((line) => {
      const previousSolde = soldesByAccount.get(line.accountId) ?? 0;
      const solde = roundCents(previousSolde + line.debit - line.credit);
      soldesByAccount.set(line.accountId, solde);
      return {
        id: line.id,
        accountId: line.accountId,
        date: line.journalEntry.entryDate,
        piece: line.journalEntry.piece,
        journalType: line.journalEntry.journalType,
        label: line.label ?? line.journalEntry.label,
        debit: line.debit,
        credit: line.credit,
        solde,
        lettrage: line.letteringCode ?? line.lettrage,
        status: line.journalEntry.status,
        accountCode: line.account.code,
        accountLabel: line.account.label,
      };
    });

    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getGrandLivre]", error);
    return { success: false, error: "Erreur lors de la récupération du grand livre" };
  }
}
