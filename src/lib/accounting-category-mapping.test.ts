import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES } from "@/lib/cashflow-categories";
import {
  CASHFLOW_ACCOUNTING_MAPPINGS,
  getAccountingFallbackForCashflowCategory,
  resolveAccountForCategory,
  type AccountingCategoryMappingRecord,
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

describe("resolveAccountForCategory", () => {
  const customMapping: AccountingCategoryMappingRecord = {
    cashflowCategoryId: "energie",
    keyword: null,
    accountCode: "606200",
    accountLabel: "Énergie - variante client",
  };

  const keywordMapping: AccountingCategoryMappingRecord = {
    cashflowCategoryId: null,
    keyword: "ASCENSEUR",
    accountCode: "615200",
    accountLabel: "Entretien ascenseurs",
  };

  it("prioritise un mapping personnalisé par cashflowCategoryId", () => {
    const res = resolveAccountForCategory([customMapping], "energie", "Énergie & fluides");
    expect(res).toMatchObject({ code: "606200", label: "Énergie - variante client" });
  });

  it("retombe sur le fallback hard-codé si aucun mapping ne matche", () => {
    const res = resolveAccountForCategory([], "energie", "Énergie");
    expect(res).toMatchObject({ code: "606100" });
  });

  it("matche par mot-clé insensible aux accents/casse sur categoryName", () => {
    const res = resolveAccountForCategory(
      [keywordMapping],
      null,
      "Entretien ascenseur et VMC"
    );
    expect(res).toMatchObject({ code: "615200" });
  });

  it("retourne null si rien ne matche et pas de fallback hard-codé", () => {
    const res = resolveAccountForCategory([], null, "Catégorie bizarre");
    expect(res).toBeNull();
  });

  it("retourne null si cashflowCategoryId inconnu et pas de keyword matching", () => {
    const res = resolveAccountForCategory([keywordMapping], "inexistant", "plombier");
    expect(res).toBeNull();
  });
});
