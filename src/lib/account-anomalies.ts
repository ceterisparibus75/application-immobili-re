/**
 * Détection automatique d'anomalies sur un compte comptable.
 *
 * Exposé via l'action server `getAccountAnomalies` (voir
 * `src/actions/account-review.ts`), mais le détecteur lui-même est écrit ici
 * — hors d'un fichier `"use server"` — pour pouvoir rester synchrone là où
 * c'est utile et être testable unitairement.
 *
 * Les cinq checks implémentés ciblent les erreurs usuelles vues en révision
 * de comptes :
 *   - UNLETTERED_LINES : lignes mouvementées non lettrées sur un compte de
 *     tiers (classe 4).
 *   - BALANCE_MISMATCH : écart débit / crédit sur un compte de bilan
 *     (classes 1 à 5) ; sur une classe 6 / 7 le solde non nul est normal
 *     (c'est le résultat).
 *   - NEGATIVE_AMOUNTS : au moins une ligne avec débit ou crédit négatif —
 *     interdit, on utilise une contrepartie et un montant positif.
 *   - DUPLICATE_PIECES : même numéro de pièce porté par plusieurs écritures
 *     touchant le compte dans l'exercice.
 *   - WRONG_SENS : compte dont `sensNormal` est défini mais dont le solde net
 *     va dans l'autre sens — avertissement, légitime en cours d'exercice.
 */

import { prisma } from "@/lib/prisma";

export type AccountAnomalyType =
  | "UNLETTERED_LINES"
  | "BALANCE_MISMATCH"
  | "NEGATIVE_AMOUNTS"
  | "DUPLICATE_PIECES"
  | "WRONG_SENS";

export type AccountAnomalySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AccountAnomaly = {
  type: AccountAnomalyType;
  severity: AccountAnomalySeverity;
  message: string;
  fix?: string;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function isBalanceSheetAccount(code: string): boolean {
  return (
    code.startsWith("1") ||
    code.startsWith("2") ||
    code.startsWith("3") ||
    code.startsWith("4") ||
    code.startsWith("5")
  );
}

/**
 * Détection pour un compte précis. Toutes les requêtes sont lancées en
 * parallèle. Le volume max par compte reste faible (balance, counts, group
 * by piece scoppés à l'exercice) — on vise < 500 ms même sur un compte très
 * mouvementé.
 */
export async function detectAccountAnomalies(
  societyId: string,
  accountId: string,
  fiscalYearId: string
): Promise<AccountAnomaly[]> {
  const [account, fiscalYear] = await Promise.all([
    prisma.accountingAccount.findFirst({
      where: { id: accountId, societyId },
      select: { id: true, code: true, label: true, sensNormal: true },
    }),
    prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, societyId },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);

  if (!account || !fiscalYear) return [];

  const dateFilter = { gte: fiscalYear.startDate, lte: fiscalYear.endDate };
  const isClass4 = account.code.startsWith("4");
  const isBalanceSheet = isBalanceSheetAccount(account.code);

  const [aggregates, unletteredCount, negativeCount, pieceEntries] =
    await Promise.all([
      prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: { societyId, entryDate: dateFilter },
        },
        _sum: { debit: true, credit: true },
      }),
      // UNLETTERED_LINES : scopé à la classe 4 — inutile de requêter pour
      // les autres classes, elles ne se lettrent pas.
      isClass4
        ? prisma.journalEntryLine.count({
            where: {
              accountId: account.id,
              letteringCode: null,
              lettrage: null,
              journalEntry: { societyId, entryDate: dateFilter },
              OR: [{ debit: { gt: 0 } }, { credit: { gt: 0 } }],
            },
          })
        : Promise.resolve(0),
      prisma.journalEntryLine.count({
        where: {
          accountId: account.id,
          journalEntry: { societyId, entryDate: dateFilter },
          OR: [{ debit: { lt: 0 } }, { credit: { lt: 0 } }],
        },
      }),
      // DUPLICATE_PIECES : on récupère les pièces des écritures touchant le
      // compte, puis on regroupe en JS. Reste rapide (une pièce par écriture,
      // pas par ligne).
      prisma.journalEntry.findMany({
        where: {
          societyId,
          entryDate: dateFilter,
          piece: { not: null },
          lines: { some: { accountId: account.id } },
        },
        select: { piece: true },
      }),
    ]);

  const anomalies: AccountAnomaly[] = [];
  const totalDebit = roundCents(aggregates._sum.debit ?? 0);
  const totalCredit = roundCents(aggregates._sum.credit ?? 0);
  const balance = roundCents(totalDebit - totalCredit);

  if (unletteredCount > 0) {
    anomalies.push({
      type: "UNLETTERED_LINES",
      severity: "HIGH",
      message: `${unletteredCount} ligne${unletteredCount > 1 ? "s" : ""} non lettrée${unletteredCount > 1 ? "s" : ""} sur ce compte de tiers.`,
      fix: "Rapprocher les factures et les règlements via le module de lettrage.",
    });
  }

  if (isBalanceSheet && Math.abs(balance) > 0.01) {
    anomalies.push({
      type: "BALANCE_MISMATCH",
      severity: "CRITICAL",
      message: `Débit ${totalDebit.toFixed(2)} € vs crédit ${totalCredit.toFixed(2)} € : écart de ${balance.toFixed(2)} €. Un compte de bilan clos doit être équilibré.`,
      fix: "Rechercher la contrepartie manquante ou l'OD de régularisation.",
    });
  }

  if (negativeCount > 0) {
    anomalies.push({
      type: "NEGATIVE_AMOUNTS",
      severity: "HIGH",
      message: `${negativeCount} ligne${negativeCount > 1 ? "s" : ""} avec un montant négatif. Les débits et crédits doivent être positifs ; une contrepartie doit être utilisée.`,
      fix: "Corriger la saisie : poser la ligne dans l'autre colonne au lieu d'un montant négatif.",
    });
  }

  // DUPLICATE_PIECES : regroupement JS, remonte au plus 5 pièces dans le
  // message pour rester lisible.
  if (pieceEntries.length > 0) {
    const counts = new Map<string, number>();
    for (const entry of pieceEntries) {
      if (!entry.piece) continue;
      counts.set(entry.piece, (counts.get(entry.piece) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      const previewPieces = duplicates
        .slice(0, 5)
        .map(([piece, count]) => `${piece} (×${count})`);
      const more = duplicates.length > previewPieces.length
        ? `, +${duplicates.length - previewPieces.length} autre${
            duplicates.length - previewPieces.length > 1 ? "s" : ""
          }`
        : "";
      anomalies.push({
        type: "DUPLICATE_PIECES",
        severity: "MEDIUM",
        message: `${duplicates.length} numéro${duplicates.length > 1 ? "s" : ""} de pièce en doublon : ${previewPieces.join(", ")}${more}.`,
        fix: "Vérifier qu'il ne s'agit pas de la même facture saisie plusieurs fois.",
      });
    }
  }

  // WRONG_SENS : seulement si sensNormal est défini et que le solde est
  // significatif. On émet un simple warning (MEDIUM) car un solde inversé
  // est fréquent en cours d'exercice (ex: trop-perçu, acompte).
  if (account.sensNormal && Math.abs(balance) > 0.01) {
    const wrongSens =
      (account.sensNormal === "DEBIT" && balance < 0) ||
      (account.sensNormal === "CREDIT" && balance > 0);
    if (wrongSens) {
      const expected = account.sensNormal === "DEBIT" ? "débiteur" : "créditeur";
      const actual = balance >= 0 ? "débiteur" : "créditeur";
      anomalies.push({
        type: "WRONG_SENS",
        severity: "MEDIUM",
        message: `Compte normalement ${expected} avec un solde ${actual} de ${Math.abs(balance).toFixed(2)} €. Peut être normal en cours d'exercice, à justifier en clôture.`,
        fix: "Documenter la cause (acompte, trop-perçu, note de crédit en attente) ou corriger.",
      });
    }
  }

  return anomalies;
}
