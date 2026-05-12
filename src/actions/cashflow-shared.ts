// Types + helpers — pas de "use server".

import { prisma } from "@/lib/prisma";
import { getAccountingFallbackForCashflowCategory } from "@/lib/accounting-category-mapping";

export type CategoryBreakdown = {
  categoryId: string;
  label: string;
  color: string;
  amount: number;
  percentage: number;
  transactionCount: number;
};

export type CashflowMonthDetail = {
  month: string;        // "2026-04"
  label: string;        // "avr. 26"
  isPast: boolean;
  // Données réelles (transactions bancaires)
  actualIncome: number;
  actualExpenses: number;
  actualNet: number;
  // Ventilation par section
  operationalIncome: number;
  operationalExpenses: number;
  operationalNet: number;
  exceptionalIncome: number;
  exceptionalExpenses: number;
  exceptionalNet: number;
  financementIn: number;
  financementOut: number;
  financementNet: number;
  // Ventilation réelle par catégorie
  expenseBreakdown: CategoryBreakdown[];
  incomeBreakdown: CategoryBreakdown[];
  // Données projetées (baux, charges, emprunts)
  projectedIncome: number;
  projectedExpenses: number;
  projectedNet: number;
};

export type CashflowDashboard = {
  months: CashflowMonthDetail[];
  totalBankBalance: number;
  uncategorizedCount: number;
  // Ventilation globale sur la période
  globalExpenseBreakdown: CategoryBreakdown[];
  globalIncomeBreakdown: CategoryBreakdown[];
  // Totaux globaux
  totalActualIncome: number;
  totalActualExpenses: number;
  totalProjectedIncome: number;
  totalProjectedExpenses: number;
  // Totaux par section
  totalOperationalIncome: number;
  totalOperationalExpenses: number;
  totalExceptionalIncome: number;
  totalExceptionalExpenses: number;
  totalFinancementIn: number;
  totalFinancementOut: number;
  bankAccountSummaries: BankAccountSummary[];
};

export type UncategorizedTransaction = {
  id: string;
  transactionDate: string;
  label: string;
  amount: number;
  reference: string | null;
  bankAccountName: string;
  suggestedCategory?: string;
};

export type BankAccountSummary = {
  accountId: string;
  accountName: string;
  balance: number;
  lastTransactionDate: string | null;
  daysSinceLastTx: number | null;
};

export type RecategorizableTransaction = {
  id: string;
  transactionDate: string;
  label: string;
  amount: number;
  reference: string | null;
  bankAccountName: string;
  category: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// getCashflowDashboard — données complètes pour le module Cash-flow
// ═══════════════════════════════════════════════════════════════════════════


export function round(v: number): number {
  return Math.round(v * 100) / 100;
}

export function buildBreakdown(
  catMap: Map<string, number>,
  categories: readonly { id: string; label: string; color: string }[]
): CategoryBreakdown[] {
  const total = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
  if (total === 0) return [];

  // Compteur approximatif — on ne compte pas les transactions individuelles ici
  return categories
    .map((cat) => {
      const amount = catMap.get(cat.id) ?? 0;
      return {
        categoryId: cat.id,
        label: cat.label,
        color: cat.color,
        amount: round(amount),
        percentage: total > 0 ? round((amount / total) * 100) : 0,
        transactionCount: amount > 0 ? 1 : 0, // Sera affiné dans globalBreakdown
      };
    })
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

// ═══════════════════════════════════════════════════════════════════════════
// categorizeTransactions — mettre à jour la catégorie de transactions
// ═══════════════════════════════════════════════════════════════════════════

export async function syncSimpleBankJournalEntryCounterpart(
  societyId: string,
  transactionId: string,
  category: string
): Promise<void> {
  const fallback = getAccountingFallbackForCashflowCategory(category);
  if (!fallback) return;

  const transaction = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, bankAccount: { societyId } },
    select: {
      amount: true,
      label: true,
      journalEntry: {
        select: {
          journalType: true,
          lines: {
            select: {
              id: true,
              debit: true,
              credit: true,
              account: { select: { code: true, type: true } },
            },
          },
        },
      },
    },
  });

  const journalEntry = transaction?.journalEntry;
  if (!transaction || !journalEntry || journalEntry.journalType !== "BQUE") return;
  if (journalEntry.lines.length !== 2) return;

  const isIncome = transaction.amount > 0;
  const bankLine = journalEntry.lines.find((line) =>
    (line.account.code.startsWith("512") || line.account.type === "5") &&
    (isIncome ? line.debit > 0 : line.credit > 0)
  );
  if (!bankLine) return;

  const contraLine = journalEntry.lines.find((line) => line.id !== bankLine.id);
  if (!contraLine) return;

  const contraAccount = await prisma.accountingAccount.upsert({
    where: { societyId_code: { societyId, code: fallback.code } },
    update: { isActive: true },
    create: {
      societyId,
      code: fallback.code,
      label: fallback.label,
      type: fallback.type,
      isActive: true,
    },
  });

  const amount = Math.abs(transaction.amount);
  await prisma.journalEntryLine.update({
    where: { id: contraLine.id },
    data: {
      accountId: contraAccount.id,
      label: transaction.label,
      debit: isIncome ? 0 : amount,
      credit: isIncome ? amount : 0,
    },
  });
}
