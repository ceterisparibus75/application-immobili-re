import { describe, expect, it } from "vitest";

import { getOutstandingAmount, getPaidAmount, getPaidAmountInPeriod, roundCurrency } from "./invoice-metrics";

describe("invoice-metrics", () => {
  it("calcule le payé et le restant dû à partir des paiements", () => {
    const invoice = {
      totalTTC: 500,
      payments: [{ amount: 120 }, { amount: 30.005 }, { amount: null }],
    };

    expect(getPaidAmount(invoice)).toBe(150.01);
    expect(getOutstandingAmount(invoice)).toBe(349.99);
  });

  it("ne retourne jamais un restant dû négatif", () => {
    expect(getOutstandingAmount({ totalTTC: 100, payments: [{ amount: 120 }] })).toBe(0);
  });

  it("calcule les paiements encaissés sur une période donnée", () => {
    expect(getPaidAmountInPeriod({
      totalTTC: 500,
      payments: [
        { amount: 100, paidAt: new Date("2025-12-31T23:00:00.000Z") },
        { amount: 200, paidAt: new Date("2026-06-15T00:00:00.000Z") },
        { amount: 300, paidAt: new Date("2027-01-01T00:00:00.000Z") },
        { amount: 50, paidAt: null },
      ],
    }, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-12-31T23:59:59.000Z"))).toBe(200);
  });

  it("arrondit les montants à deux décimales", () => {
    expect(roundCurrency(10.005)).toBe(10.01);
  });
});
