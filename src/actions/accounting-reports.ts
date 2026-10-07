"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import { Prisma, type JournalType } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  getAccountingJournalTypeAliases,
  isAccountingJournalType,
} from "@/lib/accounting-journals";
import { roundCents, type BalanceRow, type GrandLivreRow } from "@/actions/accounting-shared";

// Bornes de pagination pour le Grand Livre.
const GRAND_LIVRE_DEFAULT_PAGE_SIZE = 100;
const GRAND_LIVRE_MAX_PAGE_SIZE = 1000;

export type GrandLivrePage = {
  data: GrandLivreRow[];
  total: number;
  page: number;
  pageSize: number;
};

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function getBalance(
  societyId: string,
  filters: { fiscalYearId?: string; classe?: string; dateFrom?: string; dateTo?: string }
): Promise<ActionResult<BalanceRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    // Agrégation SQL : GROUP BY accountId côté Postgres pour éviter de
    // ramener toutes les lignes en mémoire (OOM sur gros exercices).
    const classeClause = filters.classe
      ? Prisma.sql`AND aa.type = ${filters.classe}`
      : Prisma.empty;
    const fyClause = filters.fiscalYearId
      ? Prisma.sql`AND je."fiscalYearId" = ${filters.fiscalYearId}`
      : Prisma.empty;
    const dateFromClause = filters.dateFrom
      ? Prisma.sql`AND je."entryDate" >= ${new Date(filters.dateFrom)}`
      : Prisma.empty;
    const dateToClause = filters.dateTo
      ? Prisma.sql`AND je."entryDate" <= ${new Date(filters.dateTo)}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<{
      accountId: string;
      code: string;
      label: string;
      classe: string;
      totalDebit: number;
      totalCredit: number;
    }>>`
      SELECT
        aa.id AS "accountId",
        aa.code AS "code",
        aa.label AS "label",
        aa.type AS "classe",
        COALESCE(SUM(jel.debit), 0)::float8 AS "totalDebit",
        COALESCE(SUM(jel.credit), 0)::float8 AS "totalCredit"
      FROM "JournalEntryLine" jel
      JOIN "AccountingAccount" aa ON jel."accountId" = aa.id
      JOIN "JournalEntry" je ON jel."journalEntryId" = je.id
      WHERE aa."societyId" = ${societyId}
      ${classeClause}
      ${fyClause}
      ${dateFromClause}
      ${dateToClause}
      GROUP BY aa.id, aa.code, aa.label, aa.type
      ORDER BY aa.code
    `;

    const data: BalanceRow[] = rows.map((row) => {
      const totalDebit = roundCents(Number(row.totalDebit));
      const totalCredit = roundCents(Number(row.totalCredit));
      const diff = totalDebit - totalCredit;
      return {
        accountId: row.accountId,
        code: row.code,
        label: row.label,
        classe: row.classe,
        totalDebit,
        totalCredit,
        soldeDebiteur: diff > 0 ? roundCents(diff) : 0,
        soldeCrediteur: diff < 0 ? roundCents(-diff) : 0,
      };
    });

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
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<GrandLivrePage>> {
  try {
    await requireSocietyActionContext(societyId);

    if (filters.journalType && !isAccountingJournalType(filters.journalType)) {
      return { success: false, error: "Journal comptable non supporté" };
    }

    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const requestedSize = Math.floor(filters.pageSize ?? GRAND_LIVRE_DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(
      GRAND_LIVRE_MAX_PAGE_SIZE,
      Math.max(1, requestedSize)
    );
    const skip = (page - 1) * pageSize;

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

    const whereClause: Prisma.JournalEntryLineWhereInput = {
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...letteringFilter,
      account: { societyId },
      journalEntry: journalEntryWhere,
    };

    // Pagination serveur : limite max 1000 lignes par appel pour éviter
    // d'exploser la mémoire sur de gros grands livres. L'UI expose
    // prev/next ; les exports CSV/PDF demandent explicitement un pageSize
    // élevé (ex. 10000) pour tout récupérer.
    // NB : le solde cumulé est calculé par compte à l'intérieur de la page.
    // Pour un solde absolu depuis le début de l'exercice, demander la page
    // complète via un pageSize suffisamment grand.
    const [lines, total] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where: whereClause,
        include: {
          account: { select: { code: true, label: true } },
          journalEntry: {
            select: { entryDate: true, piece: true, journalType: true, label: true, status: true },
          },
        },
        orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.journalEntryLine.count({ where: whereClause }),
    ]);

    // Calcul du solde cumulé indépendant par compte (sur la page courante).
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

    return { success: true, data: { data, total, page, pageSize } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getGrandLivre]", error);
    return { success: false, error: "Erreur lors de la récupération du grand livre" };
  }
}
