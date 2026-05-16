import { describe, expect, it } from "vitest";

import {
  canAddAllocation,
  computeReconciliationStatus,
} from "./transaction-reconciliation-status";

describe("computeReconciliationStatus", () => {
  it("status NONE quand pas d'allocation", () => {
    const r = computeReconciliationStatus({ transactionAmount: 1200, allocations: [] });
    expect(r.status).toBe("NONE");
    expect(r.allocated).toBe(0);
    expect(r.remaining).toBe(1200);
    expect(r.isFullyReconciled).toBe(false);
  });

  it("FULL quand somme = montant transaction (1-1)", () => {
    const r = computeReconciliationStatus({ transactionAmount: 1200, allocations: [1200] });
    expect(r.status).toBe("FULL");
    expect(r.remaining).toBe(0);
    expect(r.excess).toBe(0);
    expect(r.isFullyReconciled).toBe(true);
  });

  it("FULL quand somme = montant via plusieurs allocations (cas Meuth 1→N)", () => {
    const r = computeReconciliationStatus({
      transactionAmount: 2400,
      allocations: [1200, 1200],
    });
    expect(r.status).toBe("FULL");
    expect(r.allocated).toBe(2400);
    expect(r.remaining).toBe(0);
  });

  it("PARTIAL quand somme < montant transaction", () => {
    const r = computeReconciliationStatus({
      transactionAmount: 2400,
      allocations: [1200],
    });
    expect(r.status).toBe("PARTIAL");
    expect(r.allocated).toBe(1200);
    expect(r.remaining).toBe(1200);
    expect(r.excess).toBe(0);
  });

  it("FULL avec excédent quand somme > montant (trop-perçu)", () => {
    const r = computeReconciliationStatus({
      transactionAmount: 2400,
      allocations: [1200, 1500],
    });
    expect(r.status).toBe("FULL");
    expect(r.isFullyReconciled).toBe(true);
    expect(r.excess).toBe(300);
    expect(r.remaining).toBe(0);
  });

  it("tolère un écart d'un centime (epsilon)", () => {
    const r = computeReconciliationStatus({
      transactionAmount: 1200,
      allocations: [600, 599.995],
    });
    expect(r.status).toBe("FULL");
  });

  it("travaille en valeur absolue (transaction débitrice)", () => {
    const r = computeReconciliationStatus({
      transactionAmount: -800,
      allocations: [800],
    });
    expect(r.status).toBe("FULL");
  });
});

describe("canAddAllocation", () => {
  it("accepte une allocation qui rentre dans le solde", () => {
    expect(canAddAllocation([1200], 600, 2400)).toEqual({ ok: true });
  });

  it("accepte une allocation qui finit exactement le total", () => {
    expect(canAddAllocation([1200], 1200, 2400)).toEqual({ ok: true });
  });

  it("rejette une allocation 0 ou négative", () => {
    const r = canAddAllocation([0], 0, 1200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/positif/i);
  });

  it("rejette si la somme excède la transaction", () => {
    const r = canAddAllocation([1200], 1300, 2400);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/d[ée]passerait/i);
  });

  it("accepte si dans la tolérance epsilon", () => {
    expect(canAddAllocation([1199.995], 0.005, 1200)).toEqual({ ok: true });
  });
});
