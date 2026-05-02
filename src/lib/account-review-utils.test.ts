import { describe, expect, it } from "vitest";

import { filterAccountReviewRows } from "./account-review-utils";
import type { AccountReviewRow } from "@/actions/account-review";

function makeRow(overrides: Partial<AccountReviewRow>): AccountReviewRow {
  return {
    accountId: "acc-1",
    code: "411000",
    label: "Locataires",
    classe: "4",
    totalDebit: 0,
    totalCredit: 0,
    balance: 0,
    status: "TODO",
    cycle: "Tiers",
    note: null,
    reviewedAt: null,
    reviewedById: null,
    ...overrides,
  };
}

describe("filterAccountReviewRows", () => {
  it("masque les comptes sans mouvement par défaut", () => {
    const rows = [
      makeRow({ accountId: "acc-empty", code: "401000" }),
      makeRow({ accountId: "acc-moved", code: "411000", totalDebit: 100 }),
    ];

    expect(filterAccountReviewRows(rows, false).map((row) => row.accountId)).toEqual(["acc-moved"]);
  });

  it("conserve les comptes sans mouvement quand le filtre est activé", () => {
    const rows = [
      makeRow({ accountId: "acc-empty", code: "401000" }),
      makeRow({ accountId: "acc-moved", code: "411000", totalCredit: 100 }),
    ];

    expect(filterAccountReviewRows(rows, true).map((row) => row.accountId)).toEqual(["acc-empty", "acc-moved"]);
  });

  it("filtre les comptes par cycle de révision", () => {
    const rows = [
      makeRow({ accountId: "acc-tiers", code: "411000", cycle: "Tiers", totalDebit: 100 }),
      makeRow({ accountId: "acc-produits", code: "706100", cycle: "Produits", totalCredit: 100 }),
    ];

    expect(filterAccountReviewRows(rows, false, "Produits").map((row) => row.accountId)).toEqual(["acc-produits"]);
  });
});
