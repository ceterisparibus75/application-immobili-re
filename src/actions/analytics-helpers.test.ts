import { describe, expect, it } from "vitest";
import {
  annualizeRent,
  calculateHhi,
  calculateRevenueChange,
  displayTenantName,
  monthLabel,
  normalizeTenantKey,
  toRiskItems,
  truncateBuildingName,
} from "./analytics-helpers";

describe("analytics helpers", () => {
  it("formate les noms de locataires physiques et moraux avec fallbacks", () => {
    expect(displayTenantName({
      entityType: "PERSONNE_MORALE",
      companyName: "ACME SAS",
      firstName: null,
      lastName: null,
    })).toBe("ACME SAS");
    expect(displayTenantName({
      entityType: "PERSONNE_MORALE",
      companyName: null,
      firstName: null,
      lastName: null,
    })).toBe("—");
    expect(displayTenantName({
      entityType: "PERSONNE_PHYSIQUE",
      companyName: null,
      firstName: "Ada",
      lastName: "Lovelace",
    })).toBe("Ada Lovelace");
  });

  it("normalise les clés locataire pour regrouper casse, accents et espaces", () => {
    expect(normalizeTenantKey("  École   du   Centre ")).toBe("ECOLE DU CENTRE");
  });

  it("calcule les variations de revenus avec les cas zéro", () => {
    expect(calculateRevenueChange(1200, 1000)).toBe(20);
    expect(calculateRevenueChange(500, 0)).toBe(100);
    expect(calculateRevenueChange(0, 0)).toBe(0);
  });

  it("annualise le loyer selon la fréquence ou le fallback mensuel", () => {
    expect(annualizeRent(100, "TRIMESTRIEL")).toBe(400);
    expect(annualizeRent(100, "INCONNUE")).toBe(1200);
  });

  it("construit les éléments de concentration triés et le HHI", () => {
    const items = toRiskItems(
      new Map([["A", 900], ["B", 100]]),
      1000,
      new Map([["A", "Bâtiment A"]])
    );

    expect(items).toEqual([
      { name: "Bâtiment A", annualRent: 900, pct: 90 },
      { name: "B", annualRent: 100, pct: 10 },
    ]);
    expect(calculateHhi(items)).toBe(8200);
  });

  it("garde les libellés d'immeuble et de mois cohérents", () => {
    expect(truncateBuildingName("Immeuble Les Acacias de Versailles")).toBe("Immeuble Les Acacias…");
    expect(truncateBuildingName("Paris 15")).toBe("Paris 15");
    expect(monthLabel(new Date("2026-04-01T00:00:00.000Z"))).toMatch(/avr|apr/i);
  });
});
