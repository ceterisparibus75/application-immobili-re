/**
 * Allocation des charges au niveau immeuble vers ses lots.
 *
 * Une `Charge` est saisie au niveau `Building`. Pour la synthèse fiscale et
 * la ventilation entre bénéficiaires en cas de démembrement, on a besoin de
 * connaître la part allouable à chaque lot.
 *
 * La règle d'allocation dépend du `ChargeCategory.allocationMethod` :
 *  - TANTIEME      : au prorata de `Lot.commonShares` (tantièmes)
 *  - SURFACE       : au prorata de `Lot.area`
 *  - NB_LOTS       : division égale (1/N par lot du building)
 *  - PERSONNALISE  : depuis `AllocationKeyEntry { lotId, percentage }`
 *  - COMPTEUR      : non implémenté (nécessite `MeterReading`), fallback NB_LOTS
 *
 * La nature de la charge module ce qui est "à la charge du propriétaire" :
 *  - PROPRIETAIRE      : 100 %
 *  - RECUPERABLE       :   0 %  (récupéré sur le locataire)
 *  - MIXTE             : 100 - recoverableRate %
 *
 * Toutes les fonctions ici sont pures (entrées = données structurées,
 * sorties = nombres). Les requêtes BDD sont faites par les helpers de
 * niveau supérieur (cf. lot-fiscal-summary).
 */

export type AllocationMethod = "TANTIEME" | "SURFACE" | "NB_LOTS" | "COMPTEUR" | "PERSONNALISE";
export type ChargeNature = "PROPRIETAIRE" | "RECUPERABLE" | "MIXTE";

export interface LotForAllocation {
  id: string;
  area: number;
  commonShares: number | null;
}

export interface AllocationKeyForCategory {
  entries: Array<{ lotId: string; percentage: number }>;
}

export interface ChargeCategoryForAllocation {
  id: string;
  nature: ChargeNature;
  recoverableRate: number | null;
  allocationMethod: AllocationMethod;
  allocationKeys: AllocationKeyForCategory[];
}

/**
 * Calcule la part du montant supportée par le propriétaire (par opposition
 * à ce qui est récupéré sur le locataire).
 */
export function ownerBornAmount(amount: number, category: Pick<ChargeCategoryForAllocation, "nature" | "recoverableRate">): number {
  switch (category.nature) {
    case "PROPRIETAIRE":
      return amount;
    case "RECUPERABLE":
      return 0;
    case "MIXTE": {
      const rate = category.recoverableRate ?? 100;
      const ownerShare = Math.max(0, Math.min(100, 100 - rate));
      return round2(amount * (ownerShare / 100));
    }
  }
}

/**
 * Retourne la quote-part (0..1) attribuée à un lot donné selon la méthode
 * d'allocation de la catégorie. Retourne 0 si le lot n'est pas concerné.
 */
export function lotShareForChargeCategory(
  lotId: string,
  category: ChargeCategoryForAllocation,
  buildingLots: LotForAllocation[],
): number {
  if (buildingLots.length === 0) return 0;
  const lot = buildingLots.find((l) => l.id === lotId);
  if (!lot) return 0;

  switch (category.allocationMethod) {
    case "PERSONNALISE": {
      // On retient la première clé personnalisée si présente
      const key = category.allocationKeys[0];
      if (!key) return 0;
      const entry = key.entries.find((e) => e.lotId === lotId);
      if (!entry) return 0;
      return Math.max(0, Math.min(1, entry.percentage / 100));
    }

    case "TANTIEME": {
      const totalShares = buildingLots.reduce((s, l) => s + (l.commonShares ?? 0), 0);
      if (totalShares === 0) {
        // Aucun tantième renseigné — fallback NB_LOTS pour ne pas perdre la charge
        return 1 / buildingLots.length;
      }
      return (lot.commonShares ?? 0) / totalShares;
    }

    case "SURFACE": {
      const totalArea = buildingLots.reduce((s, l) => s + (l.area ?? 0), 0);
      if (totalArea === 0) return 1 / buildingLots.length;
      return (lot.area ?? 0) / totalArea;
    }

    case "NB_LOTS":
    case "COMPTEUR": // fallback en l'absence de relevés
      return 1 / buildingLots.length;
  }
}

/**
 * Combine `ownerBornAmount` et `lotShareForChargeCategory` pour retourner
 * la part d'une charge effectivement à reporter sur un lot pour la fiscalité.
 */
export function allocateChargeToLot(
  charge: { amount: number },
  category: ChargeCategoryForAllocation,
  lotId: string,
  buildingLots: LotForAllocation[],
): number {
  const ownerAmount = ownerBornAmount(charge.amount, category);
  if (ownerAmount === 0) return 0;
  const share = lotShareForChargeCategory(lotId, category, buildingLots);
  return round2(ownerAmount * share);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
