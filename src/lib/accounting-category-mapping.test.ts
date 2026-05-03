import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES } from "@/lib/cashflow-categories";
import {
  CASHFLOW_ACCOUNTING_MAPPINGS,
  getAccountingFallbackForCashflowCategory,
} from "@/lib/accounting-category-mapping";

describe("accounting-category-mapping", () => {
  it("couvre toutes les catégories cash-flow", () => {
    const missing = ALL_CATEGORIES
      .map((category) => category.id)
      .filter((id) => !CASHFLOW_ACCOUNTING_MAPPINGS[id]);

    expect(missing).toEqual([]);
  });

  it("mappe les catégories métier principales vers les comptes comptables", () => {
    expect(getAccountingFallbackForCashflowCategory("loyers")).toMatchObject({ code: "706100" });
    expect(getAccountingFallbackForCashflowCategory("charges_locatives")).toMatchObject({ code: "708100" });
    expect(getAccountingFallbackForCashflowCategory("energie")).toMatchObject({ code: "606100" });
    expect(getAccountingFallbackForCashflowCategory("remboursement_emprunt")).toMatchObject({ code: "164000" });
  });

  it("ignore les catégories inconnues", () => {
    expect(getAccountingFallbackForCashflowCategory("categorie_inconnue")).toBeNull();
    expect(getAccountingFallbackForCashflowCategory(null)).toBeNull();
  });
});
