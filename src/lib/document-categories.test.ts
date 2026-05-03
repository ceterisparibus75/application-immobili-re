import { describe, it, expect } from "vitest";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_GROUPS } from "./document-categories";

describe("DOCUMENT_CATEGORIES", () => {
  it("expose toutes les catégories déclarées dans les groupes", () => {
    const groupedCount = DOCUMENT_CATEGORY_GROUPS.reduce((count, group) => count + group.items.length, 0);
    expect(DOCUMENT_CATEGORIES).toHaveLength(groupedCount);
  });

  it("contient les catégories clés", () => {
    const values = DOCUMENT_CATEGORIES.map((c) => c.value);
    expect(values).toContain("bail");
    expect(values).toContain("diagnostic");
    expect(values).toContain("quittance");
    expect(values).toContain("facture");
    expect(values).toContain("autre");
  });

  it("chaque catégorie a value et label", () => {
    for (const cat of DOCUMENT_CATEGORIES) {
      expect(cat.value).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  it("les valeurs sont uniques", () => {
    const values = DOCUMENT_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
