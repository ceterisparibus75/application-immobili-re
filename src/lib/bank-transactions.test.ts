import { describe, expect, it } from "vitest";

import { buildMonthlyTransactionGroups } from "./bank-transactions";

describe("buildMonthlyTransactionGroups", () => {
  it("regroupe les operations par mois avec les totaux du mois", () => {
    const groups = buildMonthlyTransactionGroups([
      { id: "tx-1", transactionDate: new Date("2026-02-10"), amount: 1200 },
      { id: "tx-2", transactionDate: new Date("2026-02-12"), amount: -200 },
      { id: "tx-3", transactionDate: new Date("2026-01-05"), amount: -50 },
    ]);

    expect(groups).toEqual([
      expect.objectContaining({
        monthKey: "2026-02",
        label: "février 2026",
        count: 2,
        totalCredit: 1200,
        totalDebit: -200,
        net: 1000,
      }),
      expect.objectContaining({
        monthKey: "2026-01",
        label: "janvier 2026",
        count: 1,
        totalCredit: 0,
        totalDebit: -50,
        net: -50,
      }),
    ]);
  });
});
