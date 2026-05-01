import { describe, expect, it } from "vitest";

import { getOutstandingAmount, getPaidAmount, roundCurrency } from "./invoice-metrics";

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

  it("arrondit les montants à deux décimales", () => {
    expect(roundCurrency(10.005)).toBe(10.01);
  });
});
