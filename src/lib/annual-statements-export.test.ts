import { describe, expect, it } from "vitest";

import { annualStatementsCsvFilename, annualStatementsToCsv } from "./annual-statements-export";
import type { AnnualStatements } from "@/actions/annual-statements";

const statements: AnnualStatements = {
  fiscalYear: {
    id: "fy-2025",
    year: 2025,
    startDate: new Date("2025-01-01T00:00:00.000Z"),
    endDate: new Date("2025-12-31T00:00:00.000Z"),
  },
  balanceSheet: {
    assets: [
      { accountId: "a1", code: "512000", label: "Banque", amount: 1234.5 },
      { accountId: "a2", code: "411000", label: "Client; test", amount: 99.99 },
    ],
    liabilities: [{ accountId: "p1", code: "120000", label: "Résultat \"bénéfice\"", amount: 500 }],
    totalAssets: 1334.49,
    totalLiabilities: 500,
    result: 500,
    balanced: false,
  },
  incomeStatement: {
    charges: [{ accountId: "c1", code: "606000", label: "Charges", amount: 250 }],
    products: [{ accountId: "r1", code: "706000", label: "Loyers", amount: 750 }],
    totalCharges: 250,
    totalProducts: 750,
    result: 500,
  },
};

describe("annualStatementsToCsv", () => {
  it("exporte les états annuels au format CSV français", () => {
    const csv = annualStatementsToCsv(statements);

    expect(csv).toContain("Exercice;2025");
    expect(csv).toContain("Nature;Bilan de gestion et résultat simplifié");
    expect(csv).toContain("Usage;Document de pilotage interne hors liasse fiscale");
    expect(csv).toContain("Période;2025-01-01 au 2025-12-31");
    expect(csv).toContain("Section;Compte;Intitulé;Montant");
    expect(csv).toContain("Actif;512000;Banque;1234,50");
    expect(csv).toContain("Actif;411000;\"Client; test\";99,99");
    expect(csv).toContain("Passif;120000;\"Résultat \"\"bénéfice\"\"\";500,00");
    expect(csv).toContain("Résultat;RESULTAT;Résultat de l'exercice;500,00");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("annualStatementsCsvFilename", () => {
  it("nomme le fichier avec l'exercice", () => {
    expect(annualStatementsCsvFilename(statements)).toBe("bilan-gestion-2025.csv");
  });
});
