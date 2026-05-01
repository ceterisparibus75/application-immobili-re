import { describe, it, expect } from "vitest";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  NEUTRAL_CATEGORIES,
  ALL_CATEGORIES,
  getCategoryLabel,
  getCategoryColor,
  isExpenseCategory,
  isIncomeCategory,
  isNeutralCategory,
} from "./cashflow-categories";

describe("constantes de catégories", () => {
  it("EXPENSE_CATEGORIES contient 12 catégories", () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(12);
  });

  it("INCOME_CATEGORIES contient 5 catégories", () => {
    expect(INCOME_CATEGORIES).toHaveLength(5);
  });

  it("NEUTRAL_CATEGORIES contient les catégories neutres", () => {
    expect(NEUTRAL_CATEGORIES).toHaveLength(3);
    expect(NEUTRAL_CATEGORIES.map((category) => category.id)).toEqual([
      "virement_interne",
      "apport_cca",
      "remboursement_cca",
    ]);
  });

  it("ALL_CATEGORIES est la somme des 3 tableaux", () => {
    expect(ALL_CATEGORIES).toHaveLength(EXPENSE_CATEGORIES.length + INCOME_CATEGORIES.length + NEUTRAL_CATEGORIES.length);
  });

  it("chaque catégorie a un id, label et color", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(typeof cat.id).toBe("string");
      expect(typeof cat.label).toBe("string");
      expect(typeof cat.color).toBe("string");
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("getCategoryLabel", () => {
  it("retourne le label d'une catégorie de dépense", () => {
    expect(getCategoryLabel("assurance")).toBe("Assurances");
  });

  it("retourne le label d'une catégorie de revenu", () => {
    expect(getCategoryLabel("loyers")).toBe("Loyers");
  });

  it("retourne le label du virement interne", () => {
    expect(getCategoryLabel("virement_interne")).toBe("Virement de compte à compte");
  });

  it("retourne l'id brut pour une catégorie inconnue", () => {
    expect(getCategoryLabel("inconnu")).toBe("inconnu");
  });
});

describe("getCategoryColor", () => {
  it("retourne la couleur d'une catégorie connue", () => {
    const color = getCategoryColor("loyers");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(color).not.toBe("#94A3B8");
  });

  it("retourne la couleur par défaut pour une catégorie inconnue", () => {
    expect(getCategoryColor("inconnu")).toBe("#94A3B8");
  });
});

describe("isExpenseCategory", () => {
  it("retourne true pour une dépense", () => {
    expect(isExpenseCategory("travaux")).toBe(true);
  });

  it("retourne false pour un revenu", () => {
    expect(isExpenseCategory("loyers")).toBe(false);
  });

  it("retourne false pour une catégorie inconnue", () => {
    expect(isExpenseCategory("inconnu")).toBe(false);
  });
});

describe("isIncomeCategory", () => {
  it("retourne true pour un revenu", () => {
    expect(isIncomeCategory("loyers")).toBe(true);
  });

  it("retourne false pour une dépense", () => {
    expect(isIncomeCategory("travaux")).toBe(false);
  });
});

describe("isNeutralCategory", () => {
  it("retourne true pour virement_interne", () => {
    expect(isNeutralCategory("virement_interne")).toBe(true);
  });

  it("retourne false pour une dépense", () => {
    expect(isNeutralCategory("assurance")).toBe(false);
  });
});
