/**
 * Helpers purs pour le statut de rapprochement d'une transaction bancaire
 * ventilée sur plusieurs factures/paiements.
 *
 * Une transaction est :
 *  - FULL    : somme(reconciliations.amount) == |transaction.amount| (à 1 ct près)
 *  - PARTIAL : 0 < somme < |amount|
 *  - NONE    : aucun rapprochement
 *
 * Le sens du montant côté transaction n'a pas d'importance ici : on travaille
 * en valeur absolue. La cohérence crédit/débit reste assurée par les actions
 * (un paiement locataire = transaction créditrice, un fournisseur = débitrice).
 */

const EPSILON = 0.01;

export type TransactionReconciliationStatus = "FULL" | "PARTIAL" | "NONE";

export interface ReconciliationStatusInput {
  /** Montant absolu de la transaction (toujours positif côté input). */
  transactionAmount: number;
  /** Montants alloués via les liaisons BankReconciliation. */
  allocations: number[];
}

export interface ReconciliationStatusResult {
  status: TransactionReconciliationStatus;
  /** Somme allouée (positive). */
  allocated: number;
  /** Reste à ventiler (transactionAmount - allocated), 0 si déjà couvert. */
  remaining: number;
  /** Excédent éventuel (allocated > transactionAmount), 0 si pas de débordement. */
  excess: number;
  /** True si la somme couvre exactement (à epsilon près) le montant de la transaction. */
  isFullyReconciled: boolean;
}

export function computeReconciliationStatus(input: ReconciliationStatusInput): ReconciliationStatusResult {
  const txAmount = Math.abs(input.transactionAmount);
  const allocated = round2(input.allocations.reduce((s, a) => s + a, 0));

  if (allocated <= EPSILON) {
    return {
      status: "NONE",
      allocated: 0,
      remaining: round2(txAmount),
      excess: 0,
      isFullyReconciled: false,
    };
  }

  const diff = round2(allocated - txAmount);

  if (Math.abs(diff) <= EPSILON) {
    return {
      status: "FULL",
      allocated,
      remaining: 0,
      excess: 0,
      isFullyReconciled: true,
    };
  }

  if (diff < 0) {
    // Sous-rapproché : reste à ventiler.
    return {
      status: "PARTIAL",
      allocated,
      remaining: round2(-diff),
      excess: 0,
      isFullyReconciled: false,
    };
  }

  // Sur-alloué (excès). Considéré comme FULL côté transaction (entièrement
  // rapprochée), avec un excédent à imputer ailleurs (TenantBalanceAdjustment).
  return {
    status: "FULL",
    allocated,
    remaining: 0,
    excess: diff,
    isFullyReconciled: true,
  };
}

/**
 * Vérifie qu'une allocation est admissible : montant > 0 et somme avec les
 * existantes <= montant de la transaction (avec tolérance epsilon).
 */
export function canAddAllocation(
  existingAllocations: number[],
  newAmount: number,
  transactionAmount: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return { ok: false, reason: "Le montant doit être strictement positif" };
  }
  const txAmount = Math.abs(transactionAmount);
  const currentTotal = existingAllocations.reduce((s, a) => s + a, 0);
  const wouldBe = round2(currentTotal + newAmount);
  if (wouldBe > txAmount + EPSILON) {
    return {
      ok: false,
      reason: `Ventilation totale (${wouldBe.toFixed(2)} €) dépasserait le montant du virement (${txAmount.toFixed(2)} €)`,
    };
  }
  return { ok: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
