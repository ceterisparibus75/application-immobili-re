import { describe, it, expect } from "vitest";
import { normalizeLabel } from "./normalize-label";

describe("normalizeLabel", () => {
  it("met en minuscules", () => {
    expect(normalizeLabel("VIREMENT LOYER")).toBe("virement loyer");
  });

  it("supprime les accents (mots courts conservés)", () => {
    // "café" = 4 chars, "thé" = 3 chars → conservés après désaccentuation
    expect(normalizeLabel("Café thé")).toBe("cafe the");
  });

  it("supprime les accents sur un libellé typique", () => {
    // "électricité" = 11 chars → supprimé par le filtre des refs longues (≥10)
    expect(normalizeLabel("Référence: électricité")).toBe("reference");
  });

  it("supprime les dates JJ/MM/AAAA", () => {
    expect(normalizeLabel("loyer 01/04/2024")).toBe("loyer");
  });

  it("supprime les dates JJ-MM-AAAA", () => {
    expect(normalizeLabel("loyer 01-04-2024")).toBe("loyer");
  });

  it("supprime les références alphanumériques longues (10 chars+)", () => {
    // ex : identifiants SEPA, numéros de transaction
    expect(normalizeLabel("virement abc1234567890 loyer")).toBe("virement loyer");
  });

  it("conserve les mots courts (< 10 chars) non numériques", () => {
    expect(normalizeLabel("loyer sci")).toBe("loyer sci");
  });

  it("remplace la ponctuation par des espaces", () => {
    expect(normalizeLabel("loyer/quittance — 2024")).toBe("loyer quittance");
  });

  it("normalise les espaces multiples en un seul", () => {
    expect(normalizeLabel("loyer   avril   2024")).toBe("loyer avril");
  });

  it("supprime les espaces en début et fin", () => {
    expect(normalizeLabel("  loyer  ")).toBe("loyer");
  });

  it("retourne une chaîne vide pour une entrée vide", () => {
    expect(normalizeLabel("")).toBe("");
  });

  it("gère une entrée qui ne contient que des éléments supprimés", () => {
    // Uniquement une date + ref longue → chaîne vide
    expect(normalizeLabel("01/04/2024 abc1234567890")).toBe("");
  });

  it("pipeline complet : libellé bancaire typique", () => {
    const result = normalizeLabel("VIR LOYER MARTIN 01/03/2025 réf. abc123def456ghi");
    expect(result).toBe("vir loyer martin ref");
  });

  it("gère les libellés avec caractères spéciaux multiples", () => {
    // "électricité" = 11 chars → supprimé comme ref longue
    const result = normalizeLabel("SEPA: Électricité — EDF (2024)");
    expect(result).toBe("sepa edf");
  });
});
