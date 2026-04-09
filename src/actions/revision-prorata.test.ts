/**
 * Tests de calcul du prorata temporis lors d'une révision de loyer.
 *
 * Vérifie la formule : loyer × (jours / totalJours) arrondi à 2 décimales
 *
 * Scénarios :
 * 1. Révision le 15 juillet — mois de 31 jours
 * 2. Révision le 1er du mois — pas de prorata
 * 3. Révision le 30 juillet — quasi tout le mois à l'ancien
 * 4. Bail trimestriel — révision en milieu de trimestre
 * 5. Pas de révision — loyer intégral
 * 6. Avec TVA 20%
 */

import { describe, it, expect } from "vitest";

/**
 * Réplique exacte de la logique de calcul dans buildRevisionProrataLines()
 * (src/actions/invoice.ts) — extraite ici pour test unitaire pur.
 */
function computeProrata(
  periodStart: Date,
  periodEnd: Date,
  revisionDate: Date | null,
  previousRentHT: number,
  newRentHT: number,
  vatRate: number,
) {
  // Pas de révision dans la période → loyer intégral au nouveau tarif
  if (!revisionDate || revisionDate <= periodStart || revisionDate > periodEnd) {
    const rentVAT = Math.round(newRentHT * vatRate / 100 * 100) / 100;
    return {
      lines: [
        {
          label: "Loyer",
          totalHT: newRentHT,
          totalVAT: rentVAT,
          totalTTC: newRentHT + rentVAT,
        },
      ],
      totalHT: newRentHT,
      totalVAT: rentVAT,
      totalTTC: newRentHT + rentVAT,
    };
  }

  // Calcul des jours — identique à buildRevisionProrataLines()
  const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
  const daysBefore = Math.round((revisionDate.getTime() - periodStart.getTime()) / 86400000);
  const daysAfter = totalDays - daysBefore;

  // Prorata
  const oldRentHT = Math.round(previousRentHT * daysBefore / totalDays * 100) / 100;
  const newRentProrata = Math.round(newRentHT * daysAfter / totalDays * 100) / 100;

  const oldVAT = Math.round(oldRentHT * vatRate / 100 * 100) / 100;
  const newVAT = Math.round(newRentProrata * vatRate / 100 * 100) / 100;

  return {
    lines: [
      {
        label: `Ancien loyer (${daysBefore}/${totalDays} j.)`,
        totalHT: oldRentHT,
        totalVAT: oldVAT,
        totalTTC: oldRentHT + oldVAT,
      },
      {
        label: `Nouveau loyer (${daysAfter}/${totalDays} j.)`,
        totalHT: newRentProrata,
        totalVAT: newVAT,
        totalTTC: newRentProrata + newVAT,
      },
    ],
    totalHT: oldRentHT + newRentProrata,
    totalVAT: oldVAT + newVAT,
    totalTTC: oldRentHT + oldVAT + newRentProrata + newVAT,
  };
}

describe("Prorata temporis — révision de loyer", () => {
  it("Cas 1 : Révision le 15 juillet — 14j ancien + 17j nouveau", () => {
    /**
     * Période     : 1er au 31 juillet (31 jours)
     * Révision    : 15 juillet
     * Ancien loyer: 1 000 €/mois
     * Nouveau     : 1 050 €/mois
     *
     * Ancien = 1 000 × 14/31 = 451.61 €
     * Nouveau = 1 050 × 17/31 = 575.81 €
     * Total = 1 027.42 €
     */
    const result = computeProrata(
      new Date("2026-07-01"),
      new Date("2026-07-31"),
      new Date("2026-07-15"),
      1000,  // ancien
      1050,  // nouveau
      0,     // sans TVA
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].totalHT).toBe(451.61);
    expect(result.lines[0].label).toContain("14/31");
    expect(result.lines[1].totalHT).toBe(575.81);
    expect(result.lines[1].label).toContain("17/31");
    expect(result.totalHT).toBeCloseTo(1027.42, 2);

    console.log("\n=== Cas 1 : Révision le 15 juillet (31 jours) ===");
    console.log(`  Ancien loyer : 1 000 × 14/31 = ${result.lines[0].totalHT} €`);
    console.log(`  Nouveau loyer: 1 050 × 17/31 = ${result.lines[1].totalHT} €`);
    console.log(`  Total facturé: ${result.totalHT} €`);
  });

  it("Cas 2 : Révision le 1er du mois — mois entier au nouveau loyer", () => {
    /**
     * La révision prend effet le 1er jour de la période.
     * Tout le mois est facturé au nouveau tarif : 1 050 €
     */
    const result = computeProrata(
      new Date("2026-07-01"),
      new Date("2026-07-31"),
      new Date("2026-07-01"), // = periodStart → exclu par la condition gt:
      1000,
      1050,
      0,
    );

    expect(result.lines).toHaveLength(1);
    expect(result.totalHT).toBe(1050);

    console.log("\n=== Cas 2 : Révision le 1er du mois ===");
    console.log(`  1 seule ligne : ${result.totalHT} € (mois entier au nouveau loyer)`);
  });

  it("Cas 3 : Révision le 30 juillet — 29j ancien + 2j nouveau", () => {
    /**
     * Ancien = 2 000 × 29/31 = 1 870.97 €
     * Nouveau = 2 100 × 2/31 = 135.48 €
     * Total = 2 006.45 €
     */
    const result = computeProrata(
      new Date("2026-07-01"),
      new Date("2026-07-31"),
      new Date("2026-07-30"),
      2000,
      2100,
      0,
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].totalHT).toBe(1870.97);
    expect(result.lines[0].label).toContain("29/31");
    expect(result.lines[1].totalHT).toBe(135.48);
    expect(result.lines[1].label).toContain("2/31");
    expect(result.totalHT).toBeCloseTo(2006.45, 2);

    console.log("\n=== Cas 3 : Révision le 30 juillet ===");
    console.log(`  Ancien loyer : 2 000 × 29/31 = ${result.lines[0].totalHT} €`);
    console.log(`  Nouveau loyer: 2 100 × 2/31 = ${result.lines[1].totalHT} €`);
    console.log(`  Total facturé: ${result.totalHT} €`);
  });

  it("Cas 4 : Bail trimestriel — révision le 15 février", () => {
    /**
     * Période     : 1er janvier au 31 mars (90 jours)
     * Révision    : 15 février
     * Jours avant = 45 (1 jan → 14 fév)
     * Jours après = 45 (15 fév → 31 mar)
     *
     * Ancien = 3 000 × 45/90 = 1 500.00 €
     * Nouveau = 3 150 × 45/90 = 1 575.00 €
     * Total = 3 075.00 €
     */
    const result = computeProrata(
      new Date("2026-01-01"),
      new Date("2026-03-31"),
      new Date("2026-02-15"),
      3000,
      3150,
      0,
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].totalHT).toBe(1500.00);
    expect(result.lines[0].label).toContain("45/90");
    expect(result.lines[1].totalHT).toBe(1575.00);
    expect(result.lines[1].label).toContain("45/90");
    expect(result.totalHT).toBe(3075.00);

    console.log("\n=== Cas 4 : Bail trimestriel, révision 15 février ===");
    console.log(`  Ancien loyer : 3 000 × 45/90 = ${result.lines[0].totalHT} €`);
    console.log(`  Nouveau loyer: 3 150 × 45/90 = ${result.lines[1].totalHT} €`);
    console.log(`  Total facturé: ${result.totalHT} €`);
  });

  it("Cas 5 : Pas de révision — loyer intégral", () => {
    const result = computeProrata(
      new Date("2026-07-01"),
      new Date("2026-07-31"),
      null,
      0,     // pas pertinent
      1050,
      0,
    );

    expect(result.lines).toHaveLength(1);
    expect(result.totalHT).toBe(1050);

    console.log("\n=== Cas 5 : Pas de révision ===");
    console.log(`  1 seule ligne : ${result.totalHT} € (loyer intégral)`);
  });

  it("Cas 6 : Avec TVA 20% — prorata HT + TVA", () => {
    /**
     * Période     : 1er au 30 juin (30 jours)
     * Révision    : 16 juin
     * Ancien loyer: 5 000 € HT, TVA 20%
     * Nouveau     : 5 250 € HT, TVA 20%
     *
     * Ancien HT  = 5 000 × 15/30 = 2 500.00 €
     * Ancien TVA = 2 500 × 20%   =   500.00 €
     * Ancien TTC =                  3 000.00 €
     *
     * Nouveau HT  = 5 250 × 15/30 = 2 625.00 €
     * Nouveau TVA = 2 625 × 20%   =   525.00 €
     * Nouveau TTC =                  3 150.00 €
     *
     * Total TTC = 6 150.00 €
     */
    const result = computeProrata(
      new Date("2026-06-01"),
      new Date("2026-06-30"),
      new Date("2026-06-16"),
      5000,
      5250,
      20,
    );

    expect(result.lines).toHaveLength(2);

    // Ancien
    expect(result.lines[0].totalHT).toBe(2500.00);
    expect(result.lines[0].totalVAT).toBe(500.00);
    expect(result.lines[0].totalTTC).toBe(3000.00);

    // Nouveau
    expect(result.lines[1].totalHT).toBe(2625.00);
    expect(result.lines[1].totalVAT).toBe(525.00);
    expect(result.lines[1].totalTTC).toBe(3150.00);

    expect(result.totalTTC).toBe(6150.00);

    console.log("\n=== Cas 6 : Avec TVA 20% ===");
    console.log(`  Ancien : ${result.lines[0].totalHT} € HT + ${result.lines[0].totalVAT} € TVA = ${result.lines[0].totalTTC} € TTC (15/30 j.)`);
    console.log(`  Nouveau: ${result.lines[1].totalHT} € HT + ${result.lines[1].totalVAT} € TVA = ${result.lines[1].totalTTC} € TTC (15/30 j.)`);
    console.log(`  Total  : ${result.totalHT} € HT + ${result.totalVAT} € TVA = ${result.totalTTC} € TTC`);
  });

  it("Cas 7 : Mois de février (28 jours) — révision le 10", () => {
    /**
     * Période     : 1er au 28 février 2026 (28 jours)
     * Révision    : 10 février
     * Ancien      : 1 400 €
     * Nouveau     : 1 470 €
     *
     * Ancien = 1 400 × 9/28 = 450.00 €
     * Nouveau = 1 470 × 19/28 = 997.50 €
     * Total = 1 447.50 €
     */
    const result = computeProrata(
      new Date("2026-02-01"),
      new Date("2026-02-28"),
      new Date("2026-02-10"),
      1400,
      1470,
      0,
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].totalHT).toBe(450.00);
    expect(result.lines[0].label).toContain("9/28");
    expect(result.lines[1].totalHT).toBe(997.50);
    expect(result.lines[1].label).toContain("19/28");
    expect(result.totalHT).toBe(1447.50);

    console.log("\n=== Cas 7 : Février (28 jours), révision le 10 ===");
    console.log(`  Ancien loyer : 1 400 × 9/28 = ${result.lines[0].totalHT} €`);
    console.log(`  Nouveau loyer: 1 470 × 19/28 = ${result.lines[1].totalHT} €`);
    console.log(`  Total facturé: ${result.totalHT} €`);
  });
});
