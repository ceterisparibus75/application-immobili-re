import { describe, expect, it } from "vitest";

import { calculateJournalEntryTotals, getBalancingPatch } from "./accounting-entry-utils";

describe("calculateJournalEntryTotals", () => {
  it("calcule les totaux et l'écart arrondis au centime", () => {
    const result = calculateJournalEntryTotals([
      { debit: "1000.005", credit: "" },
      { debit: "", credit: "400" },
    ]);

    expect(result).toEqual({
      totalDebit: 1000.01,
      totalCredit: 400,
      difference: 600.01,
      isBalanced: false,
    });
  });
});

describe("getBalancingPatch", () => {
  it("retourne un débit à ajouter quand le crédit est supérieur", () => {
    const result = getBalancingPatch([
      { debit: "", credit: "250" },
    ]);

    expect(result).toEqual({ debit: "250.00", credit: "" });
  });

  it("retourne un crédit à ajouter quand le débit est supérieur", () => {
    const result = getBalancingPatch([
      { debit: "99.9", credit: "" },
    ]);

    expect(result).toEqual({ debit: "", credit: "99.90" });
  });

  it("ne retourne rien quand l'écriture est déjà équilibrée", () => {
    const result = getBalancingPatch([
      { debit: "100", credit: "" },
      { debit: "", credit: "100" },
    ]);

    expect(result).toBeNull();
  });
});
