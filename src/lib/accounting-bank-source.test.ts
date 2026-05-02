import { describe, expect, it } from "vitest";

import { getBankTransactionSourceLink } from "./accounting-bank-source";

describe("getBankTransactionSourceLink", () => {
  it("construit un lien vers le compte bancaire filtre sur le mois de la transaction", () => {
    expect(
      getBankTransactionSourceLink({
        bankAccountId: "bank-1",
        transactionDate: new Date("2026-04-18T12:00:00.000Z"),
      })
    ).toBe("/banque/bank-1?period=month&month=2026-04");
  });
});
