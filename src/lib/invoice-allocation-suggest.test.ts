import { describe, expect, it } from "vitest";

import { suggestAllocations, type CandidateInvoice } from "./invoice-allocation-suggest";

function mk(id: string, remaining: number, daysOffset = 0): CandidateInvoice {
  return {
    id,
    remaining,
    dueDate: new Date(2026, 0, 1 + daysOffset),
    tenantId: "tenant-1",
  };
}

describe("suggestAllocations", () => {
  it("cas Meuth : 2400 = 1200 + 1200 → suggère la combinaison", () => {
    const r = suggestAllocations(2400, [
      mk("inv-A", 1200, 0),
      mk("inv-B", 1200, 30),
      mk("inv-C", 800, 60),
    ]);
    expect(r.length).toBeGreaterThan(0);
    const top = r[0];
    expect(top.invoiceIds.sort()).toEqual(["inv-A", "inv-B"]);
    expect(top.delta).toBe(0);
    expect(top.total).toBe(2400);
  });

  it("match exact 1-1 préféré aux combinaisons 2-1", () => {
    const r = suggestAllocations(1200, [
      mk("inv-A", 1200, 0),
      mk("inv-B", 600, 30),
      mk("inv-C", 600, 60),
    ]);
    expect(r[0].invoiceIds).toEqual(["inv-A"]);
  });

  it("trouve une combinaison à 3 factures quand aucune combinaison plus courte ne marche", () => {
    const r = suggestAllocations(900, [
      mk("inv-A", 300),
      mk("inv-B", 300),
      mk("inv-C", 300),
      mk("inv-D", 700),
    ]);
    expect(r[0].invoiceIds.sort()).toEqual(["inv-A", "inv-B", "inv-C"]);
    expect(r[0].total).toBe(900);
  });

  it("préfère une combinaison courte (2 factures) à une longue (3 factures) à somme égale", () => {
    const r = suggestAllocations(900, [
      mk("inv-A", 300),
      mk("inv-B", 300),
      mk("inv-C", 300),
      mk("inv-D", 600),
    ]);
    // 600+300 (taille 2) bat 300+300+300 (taille 3)
    expect(r[0].invoiceIds).toHaveLength(2);
    expect(r[0].total).toBe(900);
  });

  it("tolère un écart d'un centime", () => {
    const r = suggestAllocations(1200, [
      mk("inv-A", 600.001),
      mk("inv-B", 599.999),
    ]);
    expect(r[0]?.delta).toBe(0);
  });

  it("propose les sous-couvertures dans la tolérance d'excédent", () => {
    const r = suggestAllocations(2500, [
      mk("inv-A", 1200),
      mk("inv-B", 1200),
    ], { allowExcessUpTo: 200 });
    expect(r[0].total).toBe(2400);
    expect(r[0].delta).toBe(100); // virement 2500, total 2400 → excédent 100
  });

  it("ne retourne rien sans match exact si allowExcess = 0", () => {
    const r = suggestAllocations(1500, [
      mk("inv-A", 1200),
      mk("inv-B", 1200),
    ]);
    expect(r).toEqual([]);
  });

  it("ignore les combinaisons au-delà de maxCombinationSize", () => {
    // 5 factures de 100 € qui somment à 500 mais maxK=4
    const r = suggestAllocations(500, [
      mk("inv-A", 100),
      mk("inv-B", 100),
      mk("inv-C", 100),
      mk("inv-D", 100),
      mk("inv-E", 100),
    ], { maxCombinationSize: 4 });
    expect(r).toEqual([]); // Aucune combinaison de 1-4 ne fait 500 ici
  });

  it("respecte maxResults", () => {
    // Beaucoup de combinaisons faisant 600
    const cands = [
      mk("a", 600), mk("b", 600), mk("c", 600),
      mk("d", 300), mk("e", 300), mk("f", 300),
    ];
    const r = suggestAllocations(600, cands, { maxResults: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
