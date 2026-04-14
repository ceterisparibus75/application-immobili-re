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
  NEUTRAL_CATEGORIES,
  ALL_CATEGORIES,
  isNeutralCategory,
} from "@/lib/cashflow-categories";
import { normalizeLabel } from "@/lib/normalize-label";

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
    const actualByMonth = new Map<string, { income: number; expenses: number; expenseCats: Map<string, number>; incomeCats: Map<string, number> }>();
    let uncategorizedCount = 0;

    for (const tx of bankTransactions) {
      // Compter toutes les transactions non catégorisées (dépenses + revenus)
      if (!tx.category) uncategorizedCount++;

      // Les virements internes sont neutres : ils ne comptent ni en revenu ni en dépense
      if (isNeutralCategory(tx.category ?? "")) continue;

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
            continue; // Ne pas ajouter une 2e fois ci-dessous
          }
        }

        bucket.expenses += absAmount;
        bucket.expenseCats.set(cat, (bucket.expenseCats.get(cat) ?? 0) + absAmount);
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

    // Récupérer les libellés pour sauvegarder les auto-tags
    const txDetails = await prisma.bankTransaction.findMany({
      where: { id: { in: txIds }, bankAccount: { societyId } },
      select: { id: true, label: true },
    });
    const txLabelMap = new Map(txDetails.map((t) => [t.id, t.label]));

    let updated = 0;
    for (const item of validItems) {
      if (!validTxIds.has(item.transactionId)) continue;
      await prisma.bankTransaction.update({
        where: { id: item.transactionId },
        data: { category: item.category },
      });
      updated++;

      // ── Auto-tag : mémoriser le pattern pour catégorisation automatique future ──
      const originalLabel = txLabelMap.get(item.transactionId);
      if (originalLabel) {
        const norm = normalizeLabel(originalLabel);
        if (norm.length >= 3) {
          await prisma.transactionAutoTag.upsert({
            where: { societyId_normalizedLabel: { societyId, normalizedLabel: norm } },
            create: {
              societyId,
              normalizedLabel: norm,
              category: item.category,
              exampleLabel: originalLabel,
              hitCount: 1,
            },
            update: {
              category: item.category,
              exampleLabel: originalLabel,
              hitCount: { increment: 1 },
            },
          });
        }
      }
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
// Vérifie d'abord les libellés déjà catégorisés, puis appelle l'IA
// uniquement pour les transactions sans correspondance connue.
// ═══════════════════════════════════════════════════════════════════════════

export async function aiSuggestCategories(
  societyId: string,
  transactionIds: string[]
): Promise<ActionResult<Array<{ transactionId: string; suggestedCategory: string; confidence: number }>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    // ── 1. Récupérer les transactions à catégoriser ─────────────────────
    const transactions = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds }, bankAccount: { societyId } },
      select: { id: true, label: true, amount: true, reference: true },
    });

    if (transactions.length === 0) return { success: false, error: "Aucune transaction trouvée" };

    // ── 2a. Vérifier les auto-tags en priorité ────────────────────────
    const autoTags = await prisma.transactionAutoTag.findMany({
      where: { societyId },
      select: { normalizedLabel: true, category: true },
    });
    const autoTagMap = new Map(autoTags.map((t) => [t.normalizedLabel, t.category]));

    // ── 2b. Construire un index des libellés déjà catégorisés ───────
    // On récupère toutes les transactions de la société qui ont une catégorie
    const categorizedTransactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: { societyId },
        category: { not: null },
      },
      select: { label: true, category: true },
    });

    // Map : libellé normalisé → { catégorie, occurrences }
    const labelCategoryMap = new Map<string, Map<string, number>>();
    for (const tx of categorizedTransactions) {
      const norm = normalizeLabel(tx.label);
      if (!norm) continue;
      if (!labelCategoryMap.has(norm)) {
        labelCategoryMap.set(norm, new Map());
      }
      const catCounts = labelCategoryMap.get(norm)!;
      catCounts.set(tx.category!, (catCounts.get(tx.category!) ?? 0) + 1);
    }

    // Fonction de lookup : vérifie d'abord les auto-tags, puis l'historique
    function findMatchingCategory(label: string): string | null {
      const norm = normalizeLabel(label);
      if (!norm) return null;

      // Priorité 1 : auto-tag explicite (posé par l'utilisateur)
      const autoTagged = autoTagMap.get(norm);
      if (autoTagged) return autoTagged;

      // Priorité 2 : correspondance exacte dans l'historique (après normalisation)
      const exactMatch = labelCategoryMap.get(norm);
      if (exactMatch) {
        let bestCat = "";
        let bestCount = 0;
        for (const [cat, count] of exactMatch) {
          if (count > bestCount) { bestCat = cat; bestCount = count; }
        }
        return bestCat || null;
      }

      // Priorité 3 : correspondance partielle (mots-clés principaux)
      const normWords = norm.split(" ").filter((w) => w.length >= 4);
      if (normWords.length === 0) return null;

      let bestMatch: { cat: string; score: number; count: number } | null = null;
      for (const [knownLabel, catCounts] of labelCategoryMap) {
        const knownWords = knownLabel.split(" ").filter((w) => w.length >= 4);
        if (knownWords.length === 0) continue;

        const common = normWords.filter((w) => knownWords.includes(w)).length;
        const score = common / Math.max(normWords.length, knownWords.length);

        if (score >= 0.6 && common >= 2) {
          let topCat = "";
          let topCount = 0;
          for (const [cat, count] of catCounts) {
            if (count > topCount) { topCat = cat; topCount = count; }
          }
          const totalCount = Array.from(catCounts.values()).reduce((s, v) => s + v, 0);
          if (!bestMatch || score > bestMatch.score || (score === bestMatch.score && totalCount > bestMatch.count)) {
            bestMatch = { cat: topCat, score, count: totalCount };
          }
        }
      }

      return bestMatch?.cat ?? null;
    }

    // ── 3. Séparer : correspondances locales vs à envoyer à l'IA ───────
    const localResults: Array<{ transactionId: string; suggestedCategory: string; confidence: number }> = [];
    const needsAI: typeof transactions = [];
    const allCatIds = new Set<string>(ALL_CATEGORIES.map((c) => c.id));

    for (const tx of transactions) {
      const matched = findMatchingCategory(tx.label);
      if (matched && allCatIds.has(matched)) {
        localResults.push({
          transactionId: tx.id,
          suggestedCategory: matched,
          confidence: 0.95, // Haute confiance : basé sur l'historique
        });
      } else {
        needsAI.push(tx);
      }
    }

    // ── 4. Si tout est résolu localement, renvoyer directement ──────────
    if (needsAI.length === 0) {
      return { success: true, data: localResults };
    }

    // ── 5. Appeler Claude pour les transactions non résolues ────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Pas de clé API : renvoyer les résultats locaux + marquer les autres en "divers"
      const fallback = needsAI.map((tx) => ({
        transactionId: tx.id,
        suggestedCategory: tx.amount < 0 ? "divers_depense" : "autres_revenus",
        confidence: 0.1,
      }));
      return { success: true, data: [...localResults, ...fallback] };
    }

    const expenseCatList = EXPENSE_CATEGORIES.map((c) => `- "${c.id}": ${c.label}`).join("\n");
    const incomeCatList = INCOME_CATEGORIES.map((c) => `- "${c.id}": ${c.label}`).join("\n");
    const neutralCatList = NEUTRAL_CATEGORIES.map((c) => `- "${c.id}": ${c.label}`).join("\n");

    const txList = needsAI.map((tx, i) =>
      `${i + 1}. id="${tx.id}" | label="${tx.label}" | montant=${tx.amount.toFixed(2)}€ (${tx.amount < 0 ? "DÉBIT" : "CRÉDIT"}) | ref="${tx.reference ?? ""}"`
    ).join("\n");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Tu es un expert comptable en gestion immobilière. Catégorise chaque transaction bancaire ci-dessous.

CATÉGORIES DE DÉPENSES (pour les montants négatifs / DÉBIT) :
${expenseCatList}

CATÉGORIES DE REVENUS (pour les montants positifs / CRÉDIT) :
${incomeCatList}

CATÉGORIES NEUTRES (pour les virements entre comptes du même propriétaire, débit OU crédit) :
${neutralCatList}

Transactions à catégoriser :
${txList}

Réponds UNIQUEMENT en JSON (tableau), sans markdown ni explication :
[{"id": "...", "category": "...", "confidence": 0.0-1.0}]

Règles :
- Utilise les catégories de DÉPENSES pour les DÉBITS (montant négatif)
- Utilise les catégories de REVENUS pour les CRÉDITS (montant positif)
- Utilise "virement_interne" pour les virements entre comptes du même propriétaire (compte courant ↔ compte courant, épargne, etc.). Indices : le libellé mentionne "VIR INST", "VIREMENT INSTANTANE", "APPROVISIONNEMENT", le nom de la société ou d'un autre compte du propriétaire
- "confidence" entre 0.0 et 1.0 (1.0 = très sûr)
- Si tu n'es pas sûr : "divers_depense" (débit) ou "autres_revenus" (crédit)
- Analyse le libellé et le montant pour déterminer la catégorie
- Prélèvements assurances → "assurance"
- Échéances de prêt → "remboursement_emprunt"
- Taxes foncières, CFE → "taxes"
- Factures EDF, eau, gaz → "energie"
- Frais de syndic/copro → "charges_copro"
- Virements vers notaire, comptable → "honoraires"
- Loyers reçus, virements locataires → "loyers"
- Provisions/charges locatives reçues → "charges_locatives"
- Dépôts de garantie reçus → "depot_garantie"`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: true, data: localResults };
    }

    const { jsonrepair } = await import("jsonrepair");
    const parsed = JSON.parse(jsonrepair(jsonMatch[0])) as Array<{ id: string; category: string; confidence: number }>;

    const aiResults = parsed
      .filter((p) => allCatIds.has(p.category))
      .map((p) => ({
        transactionId: p.id,
        suggestedCategory: p.category,
        confidence: Math.min(1, Math.max(0, p.confidence)),
      }));

    // ── 6. Fusionner résultats locaux + IA ──────────────────────────────
    return { success: true, data: [...localResults, ...aiResults] };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[aiSuggestCategories]", error);
    return { success: false, error: "Erreur lors de la suggestion IA" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// applyAutoTag — catégorisation automatique à l'import
// Vérifie si le libellé correspond à un auto-tag existant pour la société.
// Retourne la catégorie si trouvée, null sinon.
// ═══════════════════════════════════════════════════════════════════════════

export async function applyAutoTag(
  societyId: string,
  label: string
): Promise<string | null> {
  const norm = normalizeLabel(label);
  if (!norm || norm.length < 3) return null;

  const tag = await prisma.transactionAutoTag.findUnique({
    where: { societyId_normalizedLabel: { societyId, normalizedLabel: norm } },
    select: { category: true },
  });

  if (tag) {
    // Incrémenter le compteur d'utilisation
    await prisma.transactionAutoTag.update({
      where: { societyId_normalizedLabel: { societyId, normalizedLabel: norm } },
      data: { hitCount: { increment: 1 } },
    });
    return tag.category;
  }

  return null;
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
