/**
 * Suggère des combinaisons de factures qui matchent un montant cible.
 *
 * Cas typiques :
 *   - 1 virement = somme exacte de N factures impayées d'un même locataire
 *   - 1 virement = somme exacte + trop-perçu raisonnable
 *
 * L'algorithme est un subset-sum borné : on cherche les sous-ensembles
 * dont la somme tombe dans [target - tolerance, target + tolerance], avec
 * un nombre d'éléments limité (par défaut 5) pour rester O(C(n, k)).
 */

const EPSILON = 0.01;

export interface CandidateInvoice {
  id: string;
  /** Montant restant dû sur la facture. */
  remaining: number;
  /** Date d'échéance (utilisée pour scorer). */
  dueDate: Date;
  tenantId: string;
}

export interface SuggestedAllocation {
  invoiceIds: string[];
  total: number;
  /** target - total. Positif si sous-couverture, négatif si trop-perçu. */
  delta: number;
  /** Score plus bas = meilleure suggestion. */
  score: number;
}

export interface SuggestOptions {
  /** Tolérance pour considérer un match exact (par défaut 0.01 €). */
  toleranceExact?: number;
  /** Nombre max de factures dans une combinaison (par défaut 4). */
  maxCombinationSize?: number;
  /** Nombre max de suggestions retournées (par défaut 5). */
  maxResults?: number;
  /**
   * Autoriser les suggestions avec excédent (target > somme) jusqu'à ce
   * montant — utile pour proposer un trop-perçu. Si 0, seuls les matches
   * exacts ou en sous-couverture sont retournés.
   */
  allowExcessUpTo?: number;
}

/**
 * Retourne une liste de combinaisons triées de la plus pertinente à la
 * moins pertinente. Les combinaisons à somme exacte (target ± toleranceExact)
 * sont toujours prioritaires.
 */
export function suggestAllocations(
  target: number,
  candidates: CandidateInvoice[],
  options: SuggestOptions = {},
): SuggestedAllocation[] {
  const toleranceExact = options.toleranceExact ?? EPSILON;
  const maxK = options.maxCombinationSize ?? 4;
  const maxResults = options.maxResults ?? 5;
  const allowExcess = options.allowExcessUpTo ?? 0;

  const sortedCandidates = [...candidates].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const all: SuggestedAllocation[] = [];

  // On limite la taille du sous-ensemble pour éviter une explosion combinatoire.
  for (let k = 1; k <= Math.min(maxK, sortedCandidates.length); k++) {
    enumerate(sortedCandidates, k, 0, [], (combo) => {
      const total = round2(combo.reduce((s, c) => s + c.remaining, 0));
      const delta = round2(target - total);

      // Exact match
      if (Math.abs(delta) <= toleranceExact) {
        all.push({
          invoiceIds: combo.map((c) => c.id),
          total,
          delta: 0,
          score: 0 + k * 0.1, // privilégier les combinaisons courtes à égalité
        });
        return;
      }

      // Excédent (target > total) : laisser passer si dans la tolérance
      if (delta > 0 && delta <= allowExcess) {
        all.push({
          invoiceIds: combo.map((c) => c.id),
          total,
          delta,
          score: 1 + delta + k * 0.1,
        });
      }
    });
  }

  return all
    .sort((a, b) => a.score - b.score)
    .slice(0, maxResults);
}

function enumerate<T>(
  arr: T[],
  k: number,
  start: number,
  current: T[],
  emit: (combo: T[]) => void,
): void {
  if (current.length === k) {
    emit(current);
    return;
  }
  for (let i = start; i < arr.length; i++) {
    current.push(arr[i]);
    enumerate(arr, k, i + 1, current, emit);
    current.pop();
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
