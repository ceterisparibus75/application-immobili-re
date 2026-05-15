import { describe, expect, it } from "vitest";

import {
  allocateChargeToLot,
  lotShareForChargeCategory,
  ownerBornAmount,
  type ChargeCategoryForAllocation,
  type LotForAllocation,
} from "./charge-allocation";

const LOT_A: LotForAllocation = { id: "a", area: 80, commonShares: 600 };
const LOT_B: LotForAllocation = { id: "b", area: 120, commonShares: 400 };
const LOTS = [LOT_A, LOT_B];

function cat(over: Partial<ChargeCategoryForAllocation>): ChargeCategoryForAllocation {
  return {
    id: "c1",
    nature: "PROPRIETAIRE",
    recoverableRate: null,
    allocationMethod: "TANTIEME",
    allocationKeys: [],
    ...over,
  };
}

describe("ownerBornAmount", () => {
  it("PROPRIETAIRE : 100 % à charge du propriétaire", () => {
    expect(ownerBornAmount(1000, cat({ nature: "PROPRIETAIRE" }))).toBe(1000);
  });

  it("RECUPERABLE : 0 % à charge (entièrement récupéré sur le locataire)", () => {
    expect(ownerBornAmount(1000, cat({ nature: "RECUPERABLE" }))).toBe(0);
  });

  it("MIXTE 80 % récupérable → 20 % propriétaire", () => {
    expect(ownerBornAmount(1000, cat({ nature: "MIXTE", recoverableRate: 80 }))).toBe(200);
  });

  it("MIXTE sans recoverableRate → fallback 100 % récupérable → 0 propriétaire", () => {
    expect(ownerBornAmount(1000, cat({ nature: "MIXTE", recoverableRate: null }))).toBe(0);
  });

  it("MIXTE 0 % récupérable → 100 % propriétaire", () => {
    expect(ownerBornAmount(1000, cat({ nature: "MIXTE", recoverableRate: 0 }))).toBe(1000);
  });
});

describe("lotShareForChargeCategory", () => {
  it("TANTIEME : ventile selon commonShares", () => {
    expect(lotShareForChargeCategory("a", cat({ allocationMethod: "TANTIEME" }), LOTS)).toBeCloseTo(0.6);
    expect(lotShareForChargeCategory("b", cat({ allocationMethod: "TANTIEME" }), LOTS)).toBeCloseTo(0.4);
  });

  it("TANTIEME : fallback NB_LOTS si aucun tantième", () => {
    const lotsNoShares = [
      { id: "a", area: 80, commonShares: null },
      { id: "b", area: 120, commonShares: null },
    ];
    expect(lotShareForChargeCategory("a", cat({ allocationMethod: "TANTIEME" }), lotsNoShares)).toBe(0.5);
  });

  it("SURFACE : ventile selon area", () => {
    // 80 / 200 = 0.4, 120 / 200 = 0.6
    expect(lotShareForChargeCategory("a", cat({ allocationMethod: "SURFACE" }), LOTS)).toBeCloseTo(0.4);
    expect(lotShareForChargeCategory("b", cat({ allocationMethod: "SURFACE" }), LOTS)).toBeCloseTo(0.6);
  });

  it("NB_LOTS : division égale", () => {
    expect(lotShareForChargeCategory("a", cat({ allocationMethod: "NB_LOTS" }), LOTS)).toBe(0.5);
    expect(lotShareForChargeCategory("b", cat({ allocationMethod: "NB_LOTS" }), LOTS)).toBe(0.5);
  });

  it("COMPTEUR : fallback NB_LOTS en l'absence d'implémentation", () => {
    expect(lotShareForChargeCategory("a", cat({ allocationMethod: "COMPTEUR" }), LOTS)).toBe(0.5);
  });

  it("PERSONNALISE : utilise la première AllocationKey", () => {
    const c = cat({
      allocationMethod: "PERSONNALISE",
      allocationKeys: [{ entries: [{ lotId: "a", percentage: 35 }, { lotId: "b", percentage: 65 }] }],
    });
    expect(lotShareForChargeCategory("a", c, LOTS)).toBeCloseTo(0.35);
    expect(lotShareForChargeCategory("b", c, LOTS)).toBeCloseTo(0.65);
  });

  it("PERSONNALISE : retourne 0 si le lot n'est pas dans la clé", () => {
    const c = cat({
      allocationMethod: "PERSONNALISE",
      allocationKeys: [{ entries: [{ lotId: "b", percentage: 100 }] }],
    });
    expect(lotShareForChargeCategory("a", c, LOTS)).toBe(0);
  });

  it("lot absent du building → 0", () => {
    expect(lotShareForChargeCategory("z", cat({}), LOTS)).toBe(0);
  });

  it("borne entre 0 et 1 en cas de saisie incohérente PERSONNALISE", () => {
    const c = cat({
      allocationMethod: "PERSONNALISE",
      allocationKeys: [{ entries: [{ lotId: "a", percentage: 150 }] }],
    });
    expect(lotShareForChargeCategory("a", c, LOTS)).toBe(1);
  });
});

describe("allocateChargeToLot", () => {
  it("charge propriétaire 1000 € au tantième 60/40 → 600 sur lot A", () => {
    const c = cat({ nature: "PROPRIETAIRE", allocationMethod: "TANTIEME" });
    expect(allocateChargeToLot({ amount: 1000 }, c, "a", LOTS)).toBe(600);
  });

  it("charge récupérable n'est jamais imputée au propriétaire", () => {
    const c = cat({ nature: "RECUPERABLE", allocationMethod: "TANTIEME" });
    expect(allocateChargeToLot({ amount: 1000 }, c, "a", LOTS)).toBe(0);
  });

  it("charge MIXTE 50 % récupérable + TANTIEME 60/40 → 300 sur lot A", () => {
    const c = cat({ nature: "MIXTE", recoverableRate: 50, allocationMethod: "TANTIEME" });
    expect(allocateChargeToLot({ amount: 1000 }, c, "a", LOTS)).toBe(300);
  });
});
