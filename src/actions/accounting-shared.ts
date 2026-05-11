// Types + helpers partagés — pas de "use server" (importé par les modules accounting-*).

import { prisma } from "@/lib/prisma";

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

export type AccountingDocumentOption = {
  id: string;
  fileName: string;
  category: string | null;
  createdAt: Date;
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
  accountId: string;
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

export type OpeningEntryLine = {
  accountId: string;
  debit: number;
  credit: number;
  label: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateDebitCreditLines(lines: Array<{ debit: number; credit: number }>): string | null {
  const invalidLine = lines.find((line) => {
    const hasDebit = Math.abs(line.debit) > 0.01;
    const hasCredit = Math.abs(line.credit) > 0.01;
    return hasDebit === hasCredit;
  });
  return invalidLine ? "Chaque ligne doit renseigner un débit ou un crédit, pas les deux" : null;
}

export async function ensureAccountingAccount(
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

export async function resolveJournalEntryDocument(
  societyId: string,
  documentId: string | null | undefined
): Promise<{ document: { id: string; fileName: string } | null; error?: string }> {
  if (!documentId) return { document: null };

  const document = await prisma.document.findFirst({
    where: { id: documentId, societyId, deletedAt: null },
    select: { id: true, fileName: true },
  });
  if (!document) return { document: null, error: "Document introuvable dans la GED" };
  return { document };
}

export async function buildFiscalYearCloseChecklist(
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
