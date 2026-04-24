import { describe, it, expect } from "vitest";
import { DOCUMENT_CATEGORIES } from "./document-categories";

describe("DOCUMENT_CATEGORIES", () => {
  it("contient 14 catégories", () => {
    expect(DOCUMENT_CATEGORIES).toHaveLength(14);
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
