"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { JournalType, Prisma } from "@/generated/prisma/client";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createFiscalYearSchema,
  createJournalEntrySchema,
  validateJournalEntriesSchema,
} from "@/validations/accounting";
import { resolveOpenFiscalYearIdForDate } from "@/lib/accounting-period";
import {
  getAccountingJournalTypeAliases,
  isAccountingJournalType,
  normalizeAccountingJournalType,
  type AccountingJournalType,
} from "@/lib/accounting-journals";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FiscalYearRow = {
  id: string;
  year: number;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  closedBy: { firstName: string | null; name: string | null } | null;
  closedAt: Date | null;
};

export type AccountRow = {
  id: string;
  code: string;
  label: string;
  type: string;
};

export type FrequentAccountRow = AccountRow & {
  usageCount: number;
  lastUsedAt: Date;
};

export type BalanceRow = {
  accountId: string;
  code: string;
  label: string;
  classe: string;
  totalDebit: number;
  totalCredit: number;
  soldeDebiteur: number;
  soldeCrediteur: number;
};

export type GrandLivreRow = {
  id: string;
  date: Date;
  piece: string | null;
  journalType: string;
  label: string;
  debit: number;
  credit: number;
  solde: number;
  lettrage: string | null;
  status: string;
  accountCode: string;
  accountLabel: string;
};

export type FiscalYearCloseCheck = {
  key: "drafts" | "balance" | "reviews";
  label: string;
  status: "PASS" | "BLOCKING";
  detail: string;
};

export type FiscalYearCloseChecklist = {
  fiscalYearId: string;
  year: number;
  isClosed: boolean;
  canClose: boolean;
  totalDebit: number;
  totalCredit: number;
  draftCount: number;
  movedAccountCount: number;
  reviewedAccountCount: number;
  issueCount: number;
  checks: FiscalYearCloseCheck[];
};

type OpeningEntryLine = {
  accountId: string;
  debit: number;
  credit: number;
  label: string;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

async function ensureAccountingAccount(
  societyId: string,
  code: string,
  label: string,
  type: string
): Promise<{ id: string }> {
  return prisma.accountingAccount.upsert({
    where: { societyId_code: { societyId, code } },
    update: { isActive: true },
    create: { societyId, code, label, type, isActive: true },
    select: { id: true },
  });
}

async function buildFiscalYearCloseChecklist(
  societyId: string,
  fiscalYearId: string
): Promise<FiscalYearCloseChecklist | null> {
  const fy = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, societyId },
    select: { id: true, year: true, isClosed: true },
  });
  if (!fy) return null;

  const drafts = await prisma.journalEntry.count({
    where: { societyId, fiscalYearId, status: "BROUILLON" },
  }) ?? 0;

  const lines = await prisma.journalEntryLine.findMany({
    where: { journalEntry: { societyId, fiscalYearId } },
    select: { debit: true, credit: true, accountId: true },
  }) ?? [];
  const totalDebit = roundCents(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundCents(lines.reduce((sum, line) => sum + line.credit, 0));
  const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  let reviewedCount = 0;
  let issueCount = 0;
  if (accountIds.length > 0) {
    reviewedCount = await prisma.accountReview.count({
      where: {
        societyId,
        fiscalYearId,
        accountId: { in: accountIds },
        status: "REVIEWED",
      },
    }) ?? 0;
    issueCount = await prisma.accountReview.count({
      where: {
        societyId,
        fiscalYearId,
        accountId: { in: accountIds },
        status: "ISSUE",
      },
    }) ?? 0;
  }

  const unreviewedCount = Math.max(accountIds.length - reviewedCount, 0);
  const checks: FiscalYearCloseCheck[] = [
    {
      key: "drafts",
      label: "Écritures validées",
      status: drafts === 0 ? "PASS" : "BLOCKING",
      detail: drafts === 0
        ? "Aucune écriture en brouillon"
        : `${drafts} écriture(s) en brouillon à valider avant la clôture`,
    },
    {
      key: "balance",
      label: "Balance équilibrée",
      status: isBalanced ? "PASS" : "BLOCKING",
      detail: isBalanced
        ? `Débit ${totalDebit.toFixed(2)} € = crédit ${totalCredit.toFixed(2)} €`
        : `La balance n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)`,
    },
    {
      key: "reviews",
      label: "Révision des comptes",
      status: issueCount === 0 && unreviewedCount === 0 ? "PASS" : "BLOCKING",
      detail: issueCount > 0
        ? `${issueCount} compte(s) ont encore un point de révision ouvert`
        : unreviewedCount > 0
          ? `${unreviewedCount} compte(s) mouvementé(s) restent à réviser avant la clôture`
          : accountIds.length === 0
            ? "Aucun compte mouvementé"
            : "Tous les comptes mouvementés sont revus",
    },
  ];

  return {
    fiscalYearId: fy.id,
    year: fy.year,
    isClosed: fy.isClosed,
    canClose: !fy.isClosed && checks.every((check) => check.status === "PASS"),
    totalDebit,
    totalCredit,
    draftCount: drafts,
    movedAccountCount: accountIds.length,
    reviewedAccountCount: reviewedCount,
    issueCount,
    checks,
  };
}

// ─── Exercices fiscaux ────────────────────────────────────────────────────────

export async function getFiscalYears(societyId: string): Promise<ActionResult<FiscalYearRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

    const rows = await prisma.fiscalYear.findMany({
      where: { societyId },
      include: {
        closedBy: { select: { firstName: true, name: true } },
      },
      orderBy: { year: "desc" },
    });

    return { success: true, data: rows };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getFiscalYears]", error);
    return { success: false, error: "Erreur lors de la récupération des exercices" };
  }
}

export async function createFiscalYear(
  societyId: string,
  input: { year: number; startDate: string; endDate: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createFiscalYearSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const existing = await prisma.fiscalYear.findUnique({
      where: { societyId_year: { societyId, year: parsed.data.year } },
    });
    if (existing) return { success: false, error: `L'exercice ${parsed.data.year} existe déjà` };

    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        societyId,
        year: parsed.data.year,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "FiscalYear",
      entityId: fiscalYear.id,
      details: { year: parsed.data.year },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: fiscalYear.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createFiscalYear]", error);
    return { success: false, error: "Erreur lors de la création de l'exercice" };
  }
}

export async function closeFiscalYear(societyId: string, fiscalYearId: string): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const checklist = await buildFiscalYearCloseChecklist(societyId, fiscalYearId);
    if (!checklist) return { success: false, error: "Exercice introuvable" };
    if (checklist.isClosed) return { success: false, error: "Cet exercice est déjà clôturé" };
    const blockingCheck = checklist.checks.find((check) => check.status === "BLOCKING");
    if (blockingCheck) return { success: false, error: blockingCheck.detail };

    await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: { isClosed: true, closedAt: new Date(), closedById: context.userId },
    });

    // Marquer toutes les écritures comme CLOTUREES
    await prisma.journalEntry.updateMany({
      where: { societyId, fiscalYearId },
      data: { status: "CLOTUREE" },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "FiscalYear",
      entityId: fiscalYearId,
      details: { action: "close", year: checklist.year },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[closeFiscalYear]", error);
    return { success: false, error: "Erreur lors de la clôture" };
  }
}

export async function getFiscalYearCloseChecklist(
  societyId: string,
  fiscalYearId: string
): Promise<ActionResult<FiscalYearCloseChecklist>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const checklist = await buildFiscalYearCloseChecklist(societyId, fiscalYearId);
    if (!checklist) return { success: false, error: "Exercice introuvable" };

    return { success: true, data: checklist };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getFiscalYearCloseChecklist]", error);
    return { success: false, error: "Erreur lors du contrôle de clôture" };
  }
}

export async function generateOpeningEntries(
  societyId: string,
  sourceFiscalYearId: string
): Promise<ActionResult<{ id: string; alreadyExists: boolean }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const source = await prisma.fiscalYear.findFirst({
      where: { id: sourceFiscalYearId, societyId },
      select: { id: true, year: true, startDate: true, endDate: true, isClosed: true },
    });
    if (!source) return { success: false, error: "Exercice source introuvable" };
    if (!source.isClosed) {
      return { success: false, error: "Les à-nouveaux ne peuvent être générés qu'après clôture de l'exercice source" };
    }

    const target = await prisma.fiscalYear.findUnique({
      where: { societyId_year: { societyId, year: source.year + 1 } },
      select: { id: true, year: true, startDate: true, isClosed: true },
    });
    if (!target) {
      return { success: false, error: `Créez d'abord l'exercice ${source.year + 1} pour générer les à-nouveaux` };
    }
    if (target.isClosed) {
      return { success: false, error: `Impossible de générer les à-nouveaux dans l'exercice ${target.year} déjà clôturé` };
    }

    const reference = `opening:${source.id}:${target.id}`;
    const existing = await prisma.journalEntry.findFirst({
      where: { societyId, reference },
      select: { id: true },
    });
    if (existing) return { success: true, data: { id: existing.id, alreadyExists: true } };

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        account: { societyId },
        journalEntry: {
          entryDate: { gte: source.startDate, lte: source.endDate },
        },
      },
      select: {
        debit: true,
        credit: true,
        accountId: true,
        account: { select: { code: true, label: true, type: true } },
      },
    });

    const totals = new Map<string, { accountId: string; code: string; label: string; type: string; debit: number; credit: number }>();
    for (const line of lines) {
      const current = totals.get(line.accountId) ?? {
        accountId: line.accountId,
        code: line.account.code,
        label: line.account.label,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };
      current.debit = roundCents(current.debit + line.debit);
      current.credit = roundCents(current.credit + line.credit);
      totals.set(line.accountId, current);
    }

    const openingLines: OpeningEntryLine[] = [];
    let products = 0;
    let charges = 0;
    for (const account of [...totals.values()].sort((a, b) => a.code.localeCompare(b.code))) {
      if (account.type === "6") {
        charges = roundCents(charges + account.debit - account.credit);
        continue;
      }
      if (account.type === "7") {
        products = roundCents(products + account.credit - account.debit);
        continue;
      }
      if (!["1", "2", "3", "4", "5"].includes(account.type)) continue;

      const balance = roundCents(account.debit - account.credit);
      if (Math.abs(balance) <= 0.01) continue;
      openingLines.push({
        accountId: account.accountId,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
        label: `A-nouveau ${account.code} - ${account.label}`,
      });
    }

    const result = roundCents(products - charges);
    if (result > 0) {
      const resultAccount = await ensureAccountingAccount(societyId, "120000", "Résultat de l'exercice (bénéfice)", "1");
      openingLines.push({ accountId: resultAccount.id, debit: 0, credit: result, label: "Résultat bénéficiaire reporté" });
    } else if (result < 0) {
      const resultAccount = await ensureAccountingAccount(societyId, "129000", "Résultat de l'exercice (perte)", "1");
      openingLines.push({ accountId: resultAccount.id, debit: Math.abs(result), credit: 0, label: "Résultat déficitaire reporté" });
    }

    const debit = roundCents(openingLines.reduce((sum, line) => sum + line.debit, 0));
    const credit = roundCents(openingLines.reduce((sum, line) => sum + line.credit, 0));
    if (openingLines.length < 2 || Math.abs(debit - credit) > 0.01) {
      return { success: false, error: "Impossible de générer des à-nouveaux équilibrés" };
    }

    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        fiscalYearId: target.id,
        journalType: "AN",
        entryDate: target.startDate,
        piece: `AN-${target.year}`,
        label: `À-nouveaux ${target.year}`,
        reference,
        status: "BROUILLON",
        lines: { create: openingLines },
      },
      select: { id: true },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { action: "GENERATE_OPENING_ENTRIES", sourceFiscalYearId, targetFiscalYearId: target.id },
    });

    revalidatePath("/comptabilite");
    revalidatePath("/comptabilite/cloture");
    return { success: true, data: { id: entry.id, alreadyExists: false } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[generateOpeningEntries]", error);
    return { success: false, error: "Erreur lors de la génération des à-nouveaux" };
  }
}

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
  }
): Promise<ActionResult<GrandLivreRow[]>> {
  try {
    await requireSocietyActionContext(societyId);

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

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.nonLettered ? { letteringCode: null, lettrage: null } : {}),
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

    // Calcul du solde cumulé
    let solde = 0;
    const data: GrandLivreRow[] = lines.map((line) => {
      solde += line.debit - line.credit;
      return {
        id: line.id,
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

// ─── Écritures ────────────────────────────────────────────────────────────────

export async function createJournalEntry(
  societyId: string,
  input: {
    journalType: string;
    entryDate: string;
    piece?: string;
    label: string;
    fiscalYearId?: string;
    lines: Array<{ accountId: string; label?: string; debit: number; credit: number }>;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createJournalEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const entryDate = new Date(parsed.data.entryDate);
    const journalType = normalizeAccountingJournalType(parsed.data.journalType as AccountingJournalType);

    // Vérifier l'équilibre débit/crédit
    const totalDebit = parsed.data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = parsed.data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: false, error: `L'écriture n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)` };
    }

    const fiscalYear = parsed.data.fiscalYearId
      ? await prisma.fiscalYear.findFirst({
          where: { id: parsed.data.fiscalYearId, societyId },
          select: { id: true, isClosed: true },
        })
      : await prisma.fiscalYear.findFirst({
          where: {
            societyId,
            startDate: { lte: entryDate },
            endDate: { gte: entryDate },
          },
          select: { id: true, isClosed: true },
        });
    if (parsed.data.fiscalYearId && !fiscalYear) return { success: false, error: "Exercice fiscal introuvable" };
    if (fiscalYear?.isClosed) return { success: false, error: "Impossible de créer une écriture dans un exercice clôturé" };

    // Vérifier que chaque compte appartient à la société
    const accountIds = [...new Set(parsed.data.lines.map((l) => l.accountId))];
    const accounts = await prisma.accountingAccount.findMany({
      where: { id: { in: accountIds }, societyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      return { success: false, error: "Un ou plusieurs comptes sont invalides" };
    }

    const entry = await prisma.journalEntry.create({
      data: {
        societyId,
        journalType: journalType as never,
        entryDate,
        piece: parsed.data.piece,
        label: parsed.data.label,
        fiscalYearId: fiscalYear?.id,
        status: "BROUILLON",
        lines: {
          create: parsed.data.lines.map((l) => ({
            accountId: l.accountId,
            label: l.label,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { journalType, piece: input.piece, label: input.label },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: entry.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createJournalEntry]", error);
    return { success: false, error: "Erreur lors de la création de l'écriture" };
  }
}

export async function updateJournalEntry(
  societyId: string,
  entryId: string,
  input: {
    journalType: string;
    entryDate: string;
    piece?: string;
    label: string;
    fiscalYearId?: string;
    lines: Array<{ accountId: string; label?: string; debit: number; credit: number }>;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const existing = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, status: true },
    });
    if (!existing) return { success: false, error: "Écriture introuvable" };
    if (existing.status !== "BROUILLON") {
      return { success: false, error: "Seules les écritures en brouillon peuvent être modifiées" };
    }

    const parsed = createJournalEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const entryDate = new Date(parsed.data.entryDate);
    const journalType = normalizeAccountingJournalType(parsed.data.journalType as AccountingJournalType);

    const totalDebit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: false, error: `L'écriture n'est pas équilibrée (débit ${totalDebit.toFixed(2)} € ≠ crédit ${totalCredit.toFixed(2)} €)` };
    }

    const fiscalYear = parsed.data.fiscalYearId
      ? await prisma.fiscalYear.findFirst({
          where: { id: parsed.data.fiscalYearId, societyId },
          select: { id: true, isClosed: true },
        })
      : await prisma.fiscalYear.findFirst({
          where: {
            societyId,
            startDate: { lte: entryDate },
            endDate: { gte: entryDate },
          },
          select: { id: true, isClosed: true },
        });
    if (parsed.data.fiscalYearId && !fiscalYear) return { success: false, error: "Exercice fiscal introuvable" };
    if (fiscalYear?.isClosed) return { success: false, error: "Impossible de modifier une écriture dans un exercice clôturé" };

    const accountIds = [...new Set(parsed.data.lines.map((line) => line.accountId))];
    const accounts = await prisma.accountingAccount.findMany({
      where: { id: { in: accountIds }, societyId },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      return { success: false, error: "Un ou plusieurs comptes sont invalides" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });
      await tx.journalEntry.update({
        where: { id: entryId },
        data: {
          journalType: journalType as never,
          entryDate,
          piece: parsed.data.piece,
          label: parsed.data.label,
          fiscalYearId: fiscalYear?.id,
          lines: {
            create: parsed.data.lines.map((line) => ({
              accountId: line.accountId,
              label: line.label,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { action: "update_draft", journalType, piece: input.piece, label: input.label },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { id: entryId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateJournalEntry]", error);
    return { success: false, error: "Erreur lors de la modification de l'écriture" };
  }
}

export async function deleteJournalEntry(
  societyId: string,
  entryId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, status: true, piece: true, label: true },
    });
    if (!entry) return { success: false, error: "Écriture introuvable" };
    if (entry.status !== "BROUILLON") {
      return { success: false, error: "Seules les écritures en brouillon peuvent être supprimées" };
    }

    await prisma.journalEntry.delete({ where: { id: entryId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { action: "delete_draft", piece: entry.piece, label: entry.label },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteJournalEntry]", error);
    return { success: false, error: "Erreur lors de la suppression de l'écriture" };
  }
}

export async function validateJournalEntry(
  societyId: string,
  entryId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, societyId },
      select: { id: true, status: true },
    });
    if (!entry) return { success: false, error: "Écriture introuvable" };
    if (entry.status !== "BROUILLON") {
      const label = entry.status === "VALIDEE" ? "validée" : "clôturée";
      return { success: false, error: `Cette écriture est déjà ${label} et ne peut plus être modifiée` };
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { status: "VALIDEE", isValidated: true, validatedById: context.userId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: entryId,
      details: { action: "validate", status: "VALIDEE" },
    });

    revalidatePath("/comptabilite");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateJournalEntry]", error);
    return { success: false, error: "Erreur lors de la validation de l'écriture" };
  }
}

export async function validateJournalEntries(
  societyId: string,
  entryIds: string[]
): Promise<ActionResult<{ validated: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = validateJournalEntriesSchema.safeParse({ entryIds });
    if (!parsed.success) return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const uniqueEntryIds = [...new Set(parsed.data.entryIds)];
    const entries = await prisma.journalEntry.findMany({
      where: { societyId, id: { in: uniqueEntryIds } },
      select: {
        id: true,
        status: true,
        lines: { select: { debit: true, credit: true } },
      },
    });

    if (entries.length !== uniqueEntryIds.length) {
      return { success: false, error: "Une ou plusieurs écritures sont introuvables" };
    }

    const notDraft = entries.find((entry) => entry.status !== "BROUILLON");
    if (notDraft) {
      return { success: false, error: "Toutes les écritures doivent être en brouillon pour être validées" };
    }

    const unbalanced = entries.find((entry) => {
      const totalDebit = roundCents(entry.lines.reduce((sum, line) => sum + line.debit, 0));
      const totalCredit = roundCents(entry.lines.reduce((sum, line) => sum + line.credit, 0));
      return Math.abs(totalDebit - totalCredit) > 0.01;
    });
    if (unbalanced) {
      return { success: false, error: "Chaque écriture doit être équilibrée avant validation" };
    }

    const result = await prisma.journalEntry.updateMany({
      where: { societyId, id: { in: uniqueEntryIds }, status: "BROUILLON" },
      data: { status: "VALIDEE", isValidated: true, validatedById: context.userId },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "JournalEntry",
      entityId: societyId,
      details: { action: "bulk_validate", count: result.count, entryIds: uniqueEntryIds },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { validated: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[validateJournalEntries]", error);
    return { success: false, error: "Erreur lors de la validation des écritures" };
  }
}

// ─── Import (fonctions conservées) ───────────────────────────────────────────

export async function bulkImportAccounts(
  societyId: string,
  accounts: Array<{ code: string; label: string; type: string; accountType?: string; sensNormal?: string }>,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!accounts.length) return { success: false, error: "Aucun compte à importer" };
    if (accounts.length > 500) return { success: false, error: "Maximum 500 comptes par import" };

    let imported = 0;
    let skipped = 0;

    for (const account of accounts) {
      const code = account.code.trim().slice(0, 10);
      const label = account.label.trim().slice(0, 255);
      const type = account.type.trim().charAt(0);
      if (!code || !label) { skipped++; continue; }

      const existing = await prisma.accountingAccount.findUnique({
        where: { societyId_code: { societyId, code } },
      });

      if (existing) {
        skipped++;
      } else {
        await prisma.accountingAccount.create({
          data: {
            societyId,
            code,
            label,
            type,
            accountType: (account.accountType as never) ?? null,
            sensNormal: (account.sensNormal as never) ?? null,
            isActive: true,
          },
        });
        imported++;
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "AccountingAccount",
      entityId: societyId,
      details: { action: "BULK_IMPORT", imported, skipped },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { imported, skipped } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkImportAccounts]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}

export type ImportJournalEntryInput = {
  journalType: string;
  entryDate: string;
  piece?: string;
  label: string;
  reference?: string;
  lines: Array<{
    accountCode: string;
    label?: string;
    debit: number;
    credit: number;
  }>;
};

function normalizeJournalType(code: string): string {
  const c = code.toUpperCase().trim();
  if (c === "AN") return "AN";
  if (c === "AC" || c.startsWith("ACH")) return "AC";
  if (c === "BQUE" || c === "BQ" || c === "BNQ" || c.startsWith("BAN")) return "BQUE";
  if (c === "INV" || c.startsWith("INV")) return "INV";
  if (c === "VT" || c.startsWith("VEN") || c === "FAC") return "VT";
  return "OD";
}

export async function bulkImportJournalEntries(
  societyId: string,
  entries: ImportJournalEntryInput[],
): Promise<ActionResult<{ imported: number; skipped: number; errors: string[] }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    if (!entries.length) return { success: false, error: "Aucune écriture à importer" };
    if (entries.length > 2000) return { success: false, error: "Maximum 2000 écritures par import" };

    const accounts = await prisma.accountingAccount.findMany({
      where: { societyId },
      select: { id: true, code: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        const journalType = normalizeJournalType(entry.journalType) as never;
        const entryDate = new Date(entry.entryDate);
        const fiscalYearId = await resolveOpenFiscalYearIdForDate(prisma, societyId, entryDate);

        const existing = await prisma.journalEntry.findFirst({
          where: {
            societyId,
            journalType,
            entryDate,
            ...(entry.piece ? { piece: entry.piece } : { label: entry.label }),
          },
        });
        if (existing) { skipped++; continue; }

        const resolvedLines: Array<{ accountId: string; label: string; debit: number; credit: number }> = [];
        let lineError = false;
        for (const line of entry.lines) {
          const accountId = accountMap.get(line.accountCode.trim());
          if (!accountId) {
            if (errors.length < 20) errors.push(`Compte ${line.accountCode} introuvable`);
            lineError = true;
            break;
          }
          resolvedLines.push({
            accountId,
            label: (line.label ?? entry.label).slice(0, 255),
            debit: line.debit,
            credit: line.credit,
          });
        }
        if (lineError) { skipped++; continue; }

        await prisma.journalEntry.create({
          data: {
            societyId,
            journalType,
            entryDate,
            piece: entry.piece,
            label: entry.label.slice(0, 255),
            reference: entry.reference,
            fiscalYearId,
            status: "BROUILLON",
            lines: { create: resolvedLines },
          },
        });
        imported++;
      } catch (e) {
        if (errors.length < 20) errors.push(`Écriture ${entry.piece ?? ""}: ${e instanceof Error ? e.message : "Erreur"}`);
        skipped++;
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "JournalEntry",
      entityId: societyId,
      details: { action: "BULK_IMPORT_ECRITURES", imported, skipped },
    });

    revalidatePath("/comptabilite");
    return { success: true, data: { imported, skipped, errors } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[bulkImportJournalEntries]", error);
    return { success: false, error: "Erreur lors de l'import" };
  }
}

// ─── Plan comptable immobilier par défaut ────────────────────────────────────

const DEFAULT_REAL_ESTATE_ACCOUNTS: Array<{ code: string; label: string; type: string; accountType: string; sensNormal: string }> = [
  // Classe 1 — Capitaux
  { code: "101000", label: "Capital social", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "104000", label: "Primes liées au capital social", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "106000", label: "Réserves", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "110000", label: "Report à nouveau (solde créditeur)", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "119000", label: "Report à nouveau (solde débiteur)", type: "1", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "120000", label: "Résultat de l'exercice (bénéfice)", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "129000", label: "Résultat de l'exercice (perte)", type: "1", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "164000", label: "Emprunts auprès des établissements de crédit", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "165000", label: "Dépôts et cautionnements reçus", type: "1", accountType: "BILAN_PASSIF", sensNormal: "C" },
  // Classe 2 — Immobilisations
  { code: "211000", label: "Terrains nus", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "212000", label: "Terrains aménagés", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "213100", label: "Immeubles d'habitation", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "213200", label: "Immeubles commerciaux", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "215700", label: "Équipements ménagers et électroménager", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "218000", label: "Matériel et mobilier", type: "2", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "281310", label: "Amortissements — Immeubles d'habitation", type: "2", accountType: "BILAN_ACTIF", sensNormal: "C" },
  { code: "281320", label: "Amortissements — Immeubles commerciaux", type: "2", accountType: "BILAN_ACTIF", sensNormal: "C" },
  // Classe 4 — Tiers
  { code: "401000", label: "Fournisseurs", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "408000", label: "Fournisseurs — Factures non parvenues", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "411000", label: "Locataires", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "416000", label: "Locataires douteux ou litigieux", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "421000", label: "Personnel — Rémunérations dues", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "431000", label: "Sécurité sociale", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "441000", label: "État — Impôts sur bénéfices", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "445510", label: "TVA à décaisser", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "445620", label: "TVA déductible sur immobilisations", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "445660", label: "TVA déductible sur autres biens et services", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "445710", label: "TVA collectée", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "455000", label: "Associés — Comptes courants", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  { code: "467000", label: "Autres comptes débiteurs ou créditeurs", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "486000", label: "Charges constatées d'avance", type: "4", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "487000", label: "Produits constatés d'avance", type: "4", accountType: "BILAN_PASSIF", sensNormal: "C" },
  // Classe 5 — Financiers
  { code: "512000", label: "Banques", type: "5", accountType: "BILAN_ACTIF", sensNormal: "D" },
  { code: "530000", label: "Caisse", type: "5", accountType: "BILAN_ACTIF", sensNormal: "D" },
  // Classe 6 — Charges
  { code: "606100", label: "Énergie — Électricité parties communes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "606120", label: "Eau — Parties communes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "606130", label: "Gaz — Parties communes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "606400", label: "Fournitures administratives et de bureau", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "611000", label: "Sous-traitance générale", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "613200", label: "Locations immobilières", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "614000", label: "Charges locatives récupérables", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "615100", label: "Entretien et réparations des bâtiments", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "615200", label: "Entretien et réparations du matériel", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "616100", label: "Assurance multirisque immeuble", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "616200", label: "Assurance loyers impayés", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "622600", label: "Honoraires (syndic, gestionnaire, expert-comptable)", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "622700", label: "Frais d'actes et de contentieux", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "623100", label: "Annonces et insertions (publicité location)", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "626000", label: "Frais postaux et de télécommunications", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "627000", label: "Services bancaires et assimilés", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "631000", label: "Impôts et taxes divers", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "635100", label: "Taxe foncière", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "635200", label: "Contribution économique territoriale (CET)", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "641000", label: "Rémunérations du personnel", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "645000", label: "Charges de sécurité sociale et de prévoyance", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "661100", label: "Intérêts des emprunts et dettes", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "671000", label: "Charges exceptionnelles sur opérations de gestion", type: "6", accountType: "CHARGE", sensNormal: "D" },
  { code: "681100", label: "Dotations aux amortissements des immobilisations", type: "6", accountType: "CHARGE", sensNormal: "D" },
  // Classe 7 — Produits
  { code: "706100", label: "Loyers — Locaux d'habitation", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706200", label: "Loyers — Locaux commerciaux", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706300", label: "Loyers — Parkings et garages", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706400", label: "Loyers — Terrains et locaux divers", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "706500", label: "Refacturation de charges locatives", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "708500", label: "Pénalités et intérêts de retard locataires", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "754000", label: "Subventions et aides au logement (APL, ALS…)", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "762000", label: "Produits des participations financières", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "775000", label: "Produits des cessions d'éléments d'actif", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "781100", label: "Reprises sur amortissements des immobilisations", type: "7", accountType: "PRODUIT", sensNormal: "C" },
  { code: "791000", label: "Transferts de charges d'exploitation", type: "7", accountType: "PRODUIT", sensNormal: "C" },
];

export async function initDefaultChartOfAccounts(
  societyId: string
): Promise<ActionResult<{ created: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const existing = await prisma.accountingAccount.count({ where: { societyId } });
    if (existing > 0) {
      return { success: false, error: `Le plan comptable contient déjà ${existing} compte(s). Utilisez l'import pour ajouter des comptes.` };
    }

    const result = await prisma.accountingAccount.createMany({
      data: DEFAULT_REAL_ESTATE_ACCOUNTS.map((a) => ({
        societyId,
        code: a.code,
        label: a.label,
        type: a.type,
        accountType: a.accountType as never,
        sensNormal: a.sensNormal as never,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "AccountingAccount",
      entityId: societyId,
      details: { action: "INIT_DEFAULT_CHART", created: result.count },
    });

    revalidatePath("/comptabilite/plan-comptable");
    return { success: true, data: { created: result.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[initDefaultChartOfAccounts]", error);
    return { success: false, error: "Erreur lors de l'initialisation du plan comptable" };
  }
}
