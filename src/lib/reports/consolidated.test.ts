import { describe, it, expect } from "vitest";
import { getReportLabel, getFrequencyLabel, computeNextRunAt, computeReportYear } from "./consolidated";

describe("getReportLabel", () => {
  it("retourne le label connu pour SITUATION_LOCATIVE", () => {
    expect(getReportLabel("SITUATION_LOCATIVE")).toBe("Situation locative");
  });

  it("retourne le label connu pour BALANCE_AGEE", () => {
    expect(getReportLabel("BALANCE_AGEE")).toBe("Balance âgée & impayés");
  });

  it("retourne la clé brute si le type est inconnu", () => {
    expect(getReportLabel("TYPE_INCONNU")).toBe("TYPE_INCONNU");
  });
});

describe("getFrequencyLabel", () => {
  it("retourne 'Mensuel' pour MENSUEL", () => {
    expect(getFrequencyLabel("MENSUEL")).toBe("Mensuel");
  });

  it("retourne 'Trimestriel' pour TRIMESTRIEL", () => {
    expect(getFrequencyLabel("TRIMESTRIEL")).toBe("Trimestriel");
  });

  it("retourne la clé brute si la fréquence est inconnue", () => {
    expect(getFrequencyLabel("BIMESTRIEL")).toBe("BIMESTRIEL");
  });
});

describe("computeNextRunAt", () => {
  // Utilisation d'une date fixe (mi-janvier 2025) pour des résultats déterministes
  const from = new Date(2025, 0, 15, 12, 0, 0); // Jan 15 2025

  it("MENSUEL → 1er du mois suivant", () => {
    const next = computeNextRunAt("MENSUEL", from);
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(1); // février
    expect(next.getDate()).toBe(1);
  });

  it("TRIMESTRIEL depuis janvier → 1er avril (début Q2)", () => {
    const next = computeNextRunAt("TRIMESTRIEL", from);
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(3); // avril
    expect(next.getDate()).toBe(1);
  });

  it("SEMESTRIEL depuis janvier → 1er juillet (S2)", () => {
    const next = computeNextRunAt("SEMESTRIEL", from);
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(6); // juillet
    expect(next.getDate()).toBe(1);
  });

  it("ANNUEL → 1er janvier de l'année suivante", () => {
    const next = computeNextRunAt("ANNUEL", from);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(0); // janvier
    expect(next.getDate()).toBe(1);
  });

  it("fréquence inconnue → 1er du mois suivant (fallback MENSUEL)", () => {
    const next = computeNextRunAt("INCONNU", from);
    expect(next.getMonth()).toBe(1); // février
    expect(next.getDate()).toBe(1);
  });

  it("fixe l'heure à 08:00:00", () => {
    const next = computeNextRunAt("MENSUEL", from);
    expect(next.getHours()).toBe(8);
    expect(next.getMinutes()).toBe(0);
    expect(next.getSeconds()).toBe(0);
  });

  it("utilise new Date() si fromDate absent (ligne 80)", () => {
    const before = new Date();
    const next = computeNextRunAt("MENSUEL");
    const after = new Date();
    // Le résultat doit être dans le futur (après now) et avoir été calculé sans erreur
    expect(next.getTime()).toBeGreaterThan(before.getTime());
    expect(next.getTime()).toBeGreaterThan(after.getTime() - 5000);
  });

  it("TRIMESTRIEL depuis avril → 1er juillet (début Q3)", () => {
    const fromApril = new Date(2025, 3, 10, 12, 0, 0); // Apr 10 2025
    const next = computeNextRunAt("TRIMESTRIEL", fromApril);
    expect(next.getMonth()).toBe(6); // juillet
    expect(next.getDate()).toBe(1);
  });
});

describe("computeReportYear", () => {
  it("retourne l'année courante pour MENSUEL", () => {
    const result = computeReportYear("MENSUEL");
    expect(result).toBe(new Date().getFullYear());
  });

  it("retourne l'année courante pour TRIMESTRIEL", () => {
    const result = computeReportYear("TRIMESTRIEL");
    expect(result).toBe(new Date().getFullYear());
  });

  it("retourne l'année courante ou précédente pour ANNUEL selon le mois", () => {
    const result = computeReportYear("ANNUEL");
    const now = new Date();
    const expected = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    expect(result).toBe(expected);
  });

  it("retourne l'année précédente pour ANNUEL en janvier (ligne 121)", () => {
    vi.setSystemTime(new Date("2026-01-15"));
    const result = computeReportYear("ANNUEL");
    vi.useRealTimers();
    expect(result).toBe(2025);
  });
});
