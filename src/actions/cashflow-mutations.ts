"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { normalizeLabel } from "@/lib/normalize-label";
import { env } from "@/lib/env";

import { syncSimpleBankJournalEntryCounterpart } from "@/actions/cashflow-shared";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  NEUTRAL_CATEGORIES,
  ALL_CATEGORIES,
} from "@/lib/cashflow-categories";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export async function categorizeTransactions(
  societyId: string,
  items: Array<{ transactionId: string; category: string }>
): Promise<ActionResult<{ updated: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

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
      try {
        await syncSimpleBankJournalEntryCounterpart(societyId, item.transactionId, item.category);
      } catch (e) {
        console.error("[cashflow-accounting-sync] Failed to sync journal entry:", e);
      }
      updated++;

      // ── Auto-tag : mémoriser le pattern pour catégorisation automatique future ──
      const originalLabel = txLabelMap.get(item.transactionId);
      if (originalLabel) {
        const norm = normalizeLabel(originalLabel);
        if (norm.length >= 3) {
          try {
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
          } catch (e) {
            // Table pas encore migrée — on continue sans bloquer la catégorisation
            console.error("[auto-tag] TransactionAutoTag upsert failed:", e);
          }
        }
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: "batch",
      details: { updated, action: "categorize" },
    });

    revalidatePath("/cashflow");
    revalidatePath("/banque");
    revalidatePath("/comptabilite/grand-livre");
    revalidatePath("/comptabilite/journaux");
    return { success: true, data: { updated } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    await requireSocietyActionContext(societyId, "COMPTABLE");

    // ── 1. Récupérer les transactions à catégoriser ─────────────────────
    const transactions = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds }, bankAccount: { societyId } },
      select: { id: true, label: true, amount: true, reference: true },
    });

    if (transactions.length === 0) return { success: false, error: "Aucune transaction trouvée" };

    // ── 2a. Vérifier les auto-tags en priorité ────────────────────────
    let autoTagMap = new Map<string, string>();
    try {
      const autoTags = await prisma.transactionAutoTag.findMany({
        where: { societyId },
        select: { normalizedLabel: true, category: true },
      });
      autoTagMap = new Map(autoTags.map((t) => [t.normalizedLabel, t.category]));
    } catch {
      // Table pas encore migrée — on continue sans auto-tags
    }

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
    const apiKey = env.ANTHROPIC_API_KEY;
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
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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

  try {
    const tag = await prisma.transactionAutoTag.findUnique({
      where: { societyId_normalizedLabel: { societyId, normalizedLabel: norm } },
      select: { category: true },
    });

    if (tag) {
      await prisma.transactionAutoTag.update({
        where: { societyId_normalizedLabel: { societyId, normalizedLabel: norm } },
        data: { hitCount: { increment: 1 } },
      });
      return tag.category;
    }
  } catch {
    // Table pas encore migrée — on continue sans auto-tags
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// getRecentTransactions — toutes les transactions N mois (pour re-catégorisation)
// ═══════════════════════════════════════════════════════════════════════════

