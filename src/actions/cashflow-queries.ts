"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isRecurringCategory,
  isFinancementCategory,
  isVirementInterne,
} from "@/lib/cashflow-categories";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  round,
  buildBreakdown,
  type CashflowDashboard,
  type CashflowMonthDetail,
  type UncategorizedTransaction,
  type RecategorizableTransaction,
  type BankAccountSummary,
  type CategoryBreakdown,
} from "@/actions/cashflow-shared";

export async function getCashflowDashboard(
  societyId: string,
  months: number = 12
): Promise<ActionResult<CashflowDashboard>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based

    // Période de données réelles : derniers 12 mois
    const actualStart = new Date(currentYear, currentMonth - 11, 1);
    // Période projetée : N mois à partir du mois courant
    const forecastEnd = new Date(currentYear, currentMonth + months, 0, 23, 59, 59);

    // ── 1. Transactions bancaires (données réelles) ──────────────────────
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        transactionDate: { gte: actualStart },
      },
      select: {
        id: true,
        transactionDate: true,
        amount: true,
        label: true,
        category: true,
        bankAccount: { select: { accountName: true } },
      },
      orderBy: { transactionDate: "asc" },
    });

    // ── 1b. Tableau d'amortissement pour ventiler capital / intérêts ────
    const amortLines = await prisma.loanAmortizationLine.findMany({
      where: {
        loan: { societyId, status: "EN_COURS" },
        dueDate: { gte: actualStart, lte: forecastEnd },
      },
      select: { dueDate: true, totalPayment: true, principalPayment: true, interestPayment: true },
    });

    // Index par mois → liste des échéances (pour rapprochement)
    const amortByMonth = new Map<string, Array<{ totalPayment: number; principalPayment: number; interestPayment: number }>>();
    for (const line of amortLines) {
      const d = new Date(line.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!amortByMonth.has(key)) amortByMonth.set(key, []);
      amortByMonth.get(key)!.push(line);
    }

    // Regrouper par mois
    type MonthBucket = {
      income: number; expenses: number;
      expenseCats: Map<string, number>; incomeCats: Map<string, number>;
      operationalIncome: number; operationalExpenses: number;
      exceptionalIncome: number; exceptionalExpenses: number;
      financementIn: number; financementOut: number;
    };
    const actualByMonth = new Map<string, MonthBucket>();
    let uncategorizedCount = 0;

    for (const tx of bankTransactions) {
      // Compter toutes les transactions non catégorisées (dépenses + revenus)
      if (!tx.category) uncategorizedCount++;

      // Virement interne : exclu de tout calcul
      if (isVirementInterne(tx.category ?? "")) continue;

      const d = new Date(tx.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (!actualByMonth.has(key)) {
        actualByMonth.set(key, {
          income: 0, expenses: 0,
          expenseCats: new Map(), incomeCats: new Map(),
          operationalIncome: 0, operationalExpenses: 0,
          exceptionalIncome: 0, exceptionalExpenses: 0,
          financementIn: 0, financementOut: 0,
        });
      }
      const bucket = actualByMonth.get(key)!;

      // Flux de financement (CCA) : section dedicee, non inclus dans revenu/depense
      if (isFinancementCategory(tx.category ?? "")) {
        if (tx.amount >= 0) {
          bucket.financementIn += tx.amount;
        } else {
          bucket.financementOut += Math.abs(tx.amount);
        }
        continue;
      }

      const cat = tx.category || (tx.amount < 0 ? "divers_depense" : "autres_revenus");
      const recurring = isRecurringCategory(cat);

      if (tx.amount >= 0) {
        bucket.income += tx.amount;
        bucket.incomeCats.set(cat, (bucket.incomeCats.get(cat) ?? 0) + tx.amount);
        if (recurring) {
          bucket.operationalIncome += tx.amount;
        } else {
          bucket.exceptionalIncome += tx.amount;
        }
      } else {
        const absAmount = Math.abs(tx.amount);

        // Ventilation automatique capital / intérêts pour les remboursements d'emprunt
        if (cat === "remboursement_emprunt") {
          const monthLines = amortByMonth.get(key) ?? [];
          // Trouver l'échéance la plus proche en montant (tolérance 15%)
          const matched = monthLines.find((l) => Math.abs(l.totalPayment - absAmount) < absAmount * 0.15);
          if (matched && matched.totalPayment > 0) {
            const interestRatio = matched.interestPayment / matched.totalPayment;
            const interestPart = round(absAmount * interestRatio);
            const capitalPart = round(absAmount - interestPart);
            bucket.expenses += absAmount;
            bucket.expenseCats.set("interets_emprunt", (bucket.expenseCats.get("interets_emprunt") ?? 0) + interestPart);
            bucket.expenseCats.set("remboursement_emprunt", (bucket.expenseCats.get("remboursement_emprunt") ?? 0) + capitalPart);
            bucket.operationalExpenses += absAmount;
            continue;
          }
        }

        bucket.expenses += absAmount;
        bucket.expenseCats.set(cat, (bucket.expenseCats.get(cat) ?? 0) + absAmount);
        if (recurring) {
          bucket.operationalExpenses += absAmount;
        } else {
          bucket.exceptionalExpenses += absAmount;
        }
      }
    }

    // ── 2. Projections : loyers actifs ───────────────────────────────────
    const activeLeases = await prisma.lease.findMany({
      where: { societyId, status: "EN_COURS" },
      select: { currentRentHT: true, vatApplicable: true, vatRate: true },
    });

    const monthlyProjectedIncome = activeLeases.reduce((sum, lease) => {
      const rentTTC = lease.vatApplicable
        ? lease.currentRentHT * (1 + lease.vatRate / 100)
        : lease.currentRentHT;
      return sum + rentTTC;
    }, 0);

    // ── 3. Projections : échéances emprunts ──────────────────────────────
    const loanLines = await prisma.loanAmortizationLine.findMany({
      where: {
        loan: { societyId, status: "EN_COURS" },
        dueDate: { gte: new Date(currentYear, currentMonth, 1), lte: forecastEnd },
      },
      select: { dueDate: true, totalPayment: true, interestPayment: true },
    });

    const loanByMonth = new Map<string, { total: number; interest: number }>();
    for (const line of loanLines) {
      const d = new Date(line.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const prev = loanByMonth.get(key) ?? { total: 0, interest: 0 };
      loanByMonth.set(key, {
        total: prev.total + line.totalPayment,
        interest: prev.interest + line.interestPayment,
      });
    }

    // ── 4. Projections : charges récurrentes ─────────────────────────────
    const charges = await prisma.charge.findMany({
      where: {
        societyId,
        OR: [
          { periodEnd: { gte: new Date(currentYear, currentMonth, 1) } },
          { periodStart: { lte: forecastEnd } },
        ],
      },
      select: { amount: true, periodStart: true, periodEnd: true },
    });

    const chargeByMonth = new Map<string, number>();
    for (const charge of charges) {
      const pStart = new Date(charge.periodStart);
      const pEnd = new Date(charge.periodEnd);
      const totalMonths = Math.max(1,
        (pEnd.getFullYear() - pStart.getFullYear()) * 12 + (pEnd.getMonth() - pStart.getMonth()) + 1
      );
      const monthlyAmount = charge.amount / totalMonths;
      const iterStart = new Date(Math.max(pStart.getTime(), new Date(currentYear, currentMonth, 1).getTime()));
      const iterEnd = new Date(Math.min(pEnd.getTime(), forecastEnd.getTime()));
      const mStart = new Date(iterStart.getFullYear(), iterStart.getMonth(), 1);
      while (mStart <= iterEnd) {
        const key = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;
        chargeByMonth.set(key, (chargeByMonth.get(key) ?? 0) + monthlyAmount);
        mStart.setMonth(mStart.getMonth() + 1);
      }
    }

    // ── 5. Soldes bancaires + dernière transaction par compte ────────────
    const bankAccountsDetail = await prisma.bankAccount.findMany({
      where: { societyId },
      select: {
        id: true,
        accountName: true,
        currentBalance: true,
        transactions: {
          orderBy: { transactionDate: "desc" },
          take: 1,
          select: { transactionDate: true },
        },
      },
    });
    const totalBankBalance = bankAccountsDetail.reduce((s, a) => s + a.currentBalance, 0);
    const nowMs = Date.now();
    const bankAccountSummaries: BankAccountSummary[] = bankAccountsDetail.map((acc) => {
      const last = acc.transactions[0]?.transactionDate ?? null;
      const days = last ? Math.floor((nowMs - last.getTime()) / 86_400_000) : null;
      return {
        accountId: acc.id,
        accountName: acc.accountName,
        balance: round(acc.currentBalance),
        lastTransactionDate: last?.toISOString() ?? null,
        daysSinceLastTx: days,
      };
    });

    // ── 6. Construire les mois ───────────────────────────────────────────
    const result: CashflowMonthDetail[] = [];
    const globalExpenses = new Map<string, { amount: number; count: number }>();
    const globalIncome = new Map<string, { amount: number; count: number }>();

    // Mois passés (12 derniers mois)
    for (let i = -11; i <= 0; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const actual = actualByMonth.get(key);
      const loan = loanByMonth.get(key) ?? { total: 0, interest: 0 };
      const chargeExp = chargeByMonth.get(key) ?? 0;
      const projExp = loan.total + chargeExp;

      const expenseBreakdown = buildBreakdown(actual?.expenseCats ?? new Map(), EXPENSE_CATEGORIES);
      const incomeBreakdown = buildBreakdown(actual?.incomeCats ?? new Map(), INCOME_CATEGORIES);

      // Accumuler globaux
      for (const b of expenseBreakdown) {
        const prev = globalExpenses.get(b.categoryId) ?? { amount: 0, count: 0 };
        globalExpenses.set(b.categoryId, { amount: prev.amount + b.amount, count: prev.count + b.transactionCount });
      }
      for (const b of incomeBreakdown) {
        const prev = globalIncome.get(b.categoryId) ?? { amount: 0, count: 0 };
        globalIncome.set(b.categoryId, { amount: prev.amount + b.amount, count: prev.count + b.transactionCount });
      }

      result.push({
        month: key,
        label,
        isPast: true,
        actualIncome: round(actual?.income ?? 0),
        actualExpenses: round(actual?.expenses ?? 0),
        actualNet: round((actual?.income ?? 0) - (actual?.expenses ?? 0)),
        operationalIncome: round(actual?.operationalIncome ?? 0),
        operationalExpenses: round(actual?.operationalExpenses ?? 0),
        operationalNet: round((actual?.operationalIncome ?? 0) - (actual?.operationalExpenses ?? 0)),
        exceptionalIncome: round(actual?.exceptionalIncome ?? 0),
        exceptionalExpenses: round(actual?.exceptionalExpenses ?? 0),
        exceptionalNet: round((actual?.exceptionalIncome ?? 0) - (actual?.exceptionalExpenses ?? 0)),
        financementIn: round(actual?.financementIn ?? 0),
        financementOut: round(actual?.financementOut ?? 0),
        financementNet: round((actual?.financementIn ?? 0) - (actual?.financementOut ?? 0)),
        expenseBreakdown,
        incomeBreakdown,
        projectedIncome: round(monthlyProjectedIncome),
        projectedExpenses: round(projExp),
        projectedNet: round(monthlyProjectedIncome - projExp),
      });
    }

    // Mois futurs
    for (let i = 1; i <= months; i++) {
      const d = new Date(currentYear, currentMonth + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const loan = loanByMonth.get(key) ?? { total: 0, interest: 0 };
      const chargeExp = chargeByMonth.get(key) ?? 0;
      const projExp = loan.total + chargeExp;

      result.push({
        month: key,
        label,
        isPast: false,
        actualIncome: 0,
        actualExpenses: 0,
        actualNet: 0,
        operationalIncome: 0,
        operationalExpenses: 0,
        operationalNet: 0,
        exceptionalIncome: 0,
        exceptionalExpenses: 0,
        exceptionalNet: 0,
        financementIn: 0,
        financementOut: 0,
        financementNet: 0,
        expenseBreakdown: [],
        incomeBreakdown: [],
        projectedIncome: round(monthlyProjectedIncome),
        projectedExpenses: round(projExp),
        projectedNet: round(monthlyProjectedIncome - projExp),
      });
    }

    // Ventilation globale
    const totalActExp = Array.from(globalExpenses.values()).reduce((s, v) => s + v.amount, 0);
    const totalActInc = Array.from(globalIncome.values()).reduce((s, v) => s + v.amount, 0);

    const globalExpenseBreakdown: CategoryBreakdown[] = EXPENSE_CATEGORIES
      .map((cat) => {
        const data = globalExpenses.get(cat.id) ?? { amount: 0, count: 0 };
        return {
          categoryId: cat.id,
          label: cat.label,
          color: cat.color,
          amount: round(data.amount),
          percentage: totalActExp > 0 ? round((data.amount / totalActExp) * 100) : 0,
          transactionCount: data.count,
        };
      })
      .filter((b) => b.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const globalIncomeBreakdown: CategoryBreakdown[] = INCOME_CATEGORIES
      .map((cat) => {
        const data = globalIncome.get(cat.id) ?? { amount: 0, count: 0 };
        return {
          categoryId: cat.id,
          label: cat.label,
          color: cat.color,
          amount: round(data.amount),
          percentage: totalActInc > 0 ? round((data.amount / totalActInc) * 100) : 0,
          transactionCount: data.count,
        };
      })
      .filter((b) => b.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const pastMonths = result.filter((m) => m.isPast);

    return {
      success: true,
      data: {
        months: result,
        totalBankBalance: round(totalBankBalance),
        uncategorizedCount,
        globalExpenseBreakdown,
        globalIncomeBreakdown,
        totalActualIncome: round(pastMonths.reduce((s, m) => s + m.actualIncome, 0)),
        totalActualExpenses: round(pastMonths.reduce((s, m) => s + m.actualExpenses, 0)),
        totalProjectedIncome: round(result.filter((m) => !m.isPast).reduce((s, m) => s + m.projectedIncome, 0)),
        totalProjectedExpenses: round(result.filter((m) => !m.isPast).reduce((s, m) => s + m.projectedExpenses, 0)),
        totalOperationalIncome: round(pastMonths.reduce((s, m) => s + m.operationalIncome, 0)),
        totalOperationalExpenses: round(pastMonths.reduce((s, m) => s + m.operationalExpenses, 0)),
        totalExceptionalIncome: round(pastMonths.reduce((s, m) => s + m.exceptionalIncome, 0)),
        totalExceptionalExpenses: round(pastMonths.reduce((s, m) => s + m.exceptionalExpenses, 0)),
        totalFinancementIn: round(Array.from(actualByMonth.values()).reduce((s, b) => s + b.financementIn, 0)),
        totalFinancementOut: round(Array.from(actualByMonth.values()).reduce((s, b) => s + b.financementOut, 0)),
        bankAccountSummaries,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getCashflowDashboard]", error);
    return { success: false, error: "Erreur lors du calcul du cash-flow" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// getUncategorizedTransactions — transactions bancaires sans catégorie
// ═══════════════════════════════════════════════════════════════════════════

export async function getUncategorizedTransactions(
  societyId: string
): Promise<ActionResult<UncategorizedTransaction[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        category: null,
      },
      select: {
        id: true,
        transactionDate: true,
        label: true,
        amount: true,
        reference: true,
        bankAccount: { select: { accountName: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    });

    return {
      success: true,
      data: transactions.map((tx) => ({
        id: tx.id,
        transactionDate: tx.transactionDate.toISOString(),
        label: tx.label,
        amount: tx.amount,
        reference: tx.reference,
        bankAccountName: tx.bankAccount.accountName,
      })),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getUncategorizedTransactions]", error);
    return { success: false, error: "Erreur lors de la récupération des transactions" };
  }
}


export async function getRecentTransactions(
  societyId: string,
  months: number = 3
): Promise<ActionResult<RecategorizableTransaction[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        transactionDate: { gte: since },
      },
      select: {
        id: true,
        bankAccountId: true,
        transactionDate: true,
        label: true,
        amount: true,
        reference: true,
        category: true,
        bankAccount: { select: { accountName: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 500,
    });

    // Dédoublonnage : même compte + même date + même montant → garder la version catégorisée
    const seen = new Map<string, (typeof transactions)[0]>();
    for (const tx of transactions) {
      const key = `${tx.bankAccountId}|${tx.transactionDate.toISOString().slice(0, 10)}|${tx.amount}`;
      const existing = seen.get(key);
      if (!existing || (!existing.category && tx.category)) {
        seen.set(key, tx);
      }
    }
    const deduped = Array.from(seen.values()).slice(0, 1000);

    return {
      success: true,
      data: deduped.map((tx) => ({
        id: tx.id,
        transactionDate: tx.transactionDate.toISOString(),
        label: tx.label,
        amount: tx.amount,
        reference: tx.reference,
        bankAccountName: tx.bankAccount.accountName,
        category: tx.category,
      })),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getRecentTransactions]", error);
    return { success: false, error: "Erreur lors de la récupération des transactions" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

