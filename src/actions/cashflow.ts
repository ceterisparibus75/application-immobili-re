"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ALL_CATEGORIES,
} from "@/lib/cashflow-categories";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

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
  // Totaux
  totalActualIncome: number;
  totalActualExpenses: number;
  totalProjectedIncome: number;
  totalProjectedExpenses: number;
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

// ═══════════════════════════════════════════════════════════════════════════
// getCashflowDashboard — données complètes pour le module Cash-flow
// ═══════════════════════════════════════════════════════════════════════════

export async function getCashflowDashboard(
  societyId: string,
  months: number = 12
): Promise<ActionResult<CashflowDashboard>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

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

    // Regrouper par mois
    const actualByMonth = new Map<string, { income: number; expenses: number; expenseCats: Map<string, number>; incomeCats: Map<string, number> }>();
    let uncategorizedCount = 0;

    for (const tx of bankTransactions) {
      const d = new Date(tx.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (!actualByMonth.has(key)) {
        actualByMonth.set(key, { income: 0, expenses: 0, expenseCats: new Map(), incomeCats: new Map() });
      }
      const bucket = actualByMonth.get(key)!;

      const cat = tx.category || (tx.amount < 0 ? "divers_depense" : "autres_revenus");

      if (tx.amount >= 0) {
        bucket.income += tx.amount;
        bucket.incomeCats.set(cat, (bucket.incomeCats.get(cat) ?? 0) + tx.amount);
      } else {
        bucket.expenses += Math.abs(tx.amount);
        bucket.expenseCats.set(cat, (bucket.expenseCats.get(cat) ?? 0) + Math.abs(tx.amount));
      }

      if (!tx.category && tx.amount < 0) uncategorizedCount++;
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

    // ── 5. Soldes bancaires ──────────────────────────────────────────────
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { societyId },
      select: { currentBalance: true },
    });
    const totalBankBalance = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);

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
      },
    };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        category: null,
        amount: { lt: 0 }, // Seulement les débits (dépenses)
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
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getUncategorizedTransactions]", error);
    return { success: false, error: "Erreur lors de la récupération des transactions" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// categorizeTransactions — mettre à jour la catégorie de transactions
// ═══════════════════════════════════════════════════════════════════════════

export async function categorizeTransactions(
  societyId: string,
  items: Array<{ transactionId: string; category: string }>
): Promise<ActionResult<{ updated: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // Valider que les catégories existent
    const validIds = new Set<string>(ALL_CATEGORIES.map((c) => c.id));
    const validItems = items.filter((i) => validIds.has(i.category));
    if (validItems.length === 0) return { success: false, error: "Aucune catégorie valide" };

    // Vérifier que les transactions appartiennent à la société
    const txIds = validItems.map((i) => i.transactionId);
    const txs = await prisma.bankTransaction.findMany({
      where: { id: { in: txIds }, bankAccount: { societyId } },
      select: { id: true },
    });
    const validTxIds = new Set(txs.map((t) => t.id));

    let updated = 0;
    for (const item of validItems) {
      if (!validTxIds.has(item.transactionId)) continue;
      await prisma.bankTransaction.update({
        where: { id: item.transactionId },
        data: { category: item.category },
      });
      updated++;
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: "batch",
      details: { updated, action: "categorize" },
    });

    revalidatePath("/comptabilite/cashflow");
    revalidatePath("/banque");
    return { success: true, data: { updated } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[categorizeTransactions]", error);
    return { success: false, error: "Erreur lors de la catégorisation" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// aiSuggestCategories — suggestion de catégories par IA (Claude)
// ═══════════════════════════════════════════════════════════════════════════

export async function aiSuggestCategories(
  societyId: string,
  transactionIds: string[]
): Promise<ActionResult<Array<{ transactionId: string; suggestedCategory: string; confidence: number }>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: "Clé API Anthropic non configurée" };

    // Récupérer les transactions
    const transactions = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds }, bankAccount: { societyId } },
      select: { id: true, label: true, amount: true, reference: true },
    });

    if (transactions.length === 0) return { success: false, error: "Aucune transaction trouvée" };

    const categoriesList = EXPENSE_CATEGORIES.map((c) => `- "${c.id}": ${c.label}`).join("\n");

    const txList = transactions.map((tx, i) =>
      `${i + 1}. id="${tx.id}" | label="${tx.label}" | montant=${tx.amount.toFixed(2)}€ | ref="${tx.reference ?? ""}"`
    ).join("\n");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Tu es un expert comptable en gestion immobilière. Catégorise chaque transaction bancaire ci-dessous dans l'une des catégories suivantes :

${categoriesList}

Transactions à catégoriser :
${txList}

Réponds UNIQUEMENT en JSON (tableau), sans markdown ni explication :
[{"id": "...", "category": "...", "confidence": 0.0-1.0}]

Règles :
- Utilise uniquement les identifiants de catégorie listés ci-dessus
- "confidence" entre 0.0 et 1.0 (1.0 = très sûr)
- Si tu n'es pas sûr, utilise "divers_depense" avec une confidence basse
- Analyse le libellé et le montant pour déterminer la catégorie
- Les prélèvements liés aux assurances → "assurance"
- Les échéances de prêt → "remboursement_emprunt"
- Les taxes foncières, CFE → "taxes"
- Les factures EDF, eau, gaz → "energie"
- Les frais de syndic/copro → "charges_copro"
- Les virements vers notaire, comptable → "honoraires"`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    // Extraire le JSON
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { success: false, error: "Réponse IA invalide" };

    const { jsonrepair } = await import("jsonrepair");
    const parsed = JSON.parse(jsonrepair(jsonMatch[0])) as Array<{ id: string; category: string; confidence: number }>;

    const result = parsed
      .filter((p) => EXPENSE_CATEGORIES.some((c) => c.id === p.category))
      .map((p) => ({
        transactionId: p.id,
        suggestedCategory: p.category,
        confidence: Math.min(1, Math.max(0, p.confidence)),
      }));

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[aiSuggestCategories]", error);
    return { success: false, error: "Erreur lors de la suggestion IA" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function buildBreakdown(
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
