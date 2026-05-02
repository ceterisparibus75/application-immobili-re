import { describe, expect, it } from "vitest";
import {
  buildGrandLivreExportGroups,
  grandLivreRowsToAccountingText,
  grandLivreRowsToDelimited,
  type GrandLivreExportRow,
} from "./grand-livre-export";

const rows: GrandLivreExportRow[] = [
  {
    id: "1",
    accountCode: "411000",
    accountLabel: "Locataires",
    date: "2026-05-02",
    piece: "P-1",
    journalType: "VT",
    label: "Loyer mai",
    debit: 700,
    credit: 0,
    solde: 700,
    lettrage: "AB",
    status: "VALIDEE",
  },
  {
    id: "2",
    accountCode: "411000",
    accountLabel: "Locataires",
    date: "2026-05-03",
    piece: "P-2",
    journalType: "VT",
    label: "Avoir avec; séparateur",
    debit: 0,
    credit: 100,
    solde: 600,
    lettrage: null,
    status: "VALIDEE",
  },
];

describe("grand-livre export", () => {
  it("groupe les lignes par compte avec totaux débit/crédit et dernier solde", () => {
    const groups = buildGrandLivreExportGroups(rows);

    expect(groups).toEqual([
      {
        accountCode: "411000",
        accountLabel: "Locataires",
        totalDebit: 700,
        totalCredit: 100,
        endingBalance: 600,
        rows,
      },
    ]);
  });

  it("exporte les mêmes colonnes que le grand livre affiché en CSV", () => {
    const csv = grandLivreRowsToDelimited(rows, ";");

    expect(csv.split("\r\n")[0]).toBe("Compte;Libellé compte;Date;Pièce;Journal;Libellé;Débit;Let.;Crédit;Solde;Statut");
    expect(csv).toContain("411000;Locataires;02/05/2026;P-1;VT;Loyer mai;700,00;AB;0,00;700,00;VALIDEE");
    expect(csv).toContain('"Avoir avec; séparateur"');
  });

  it("exporte le TXT sur les colonnes comptables importables", () => {
    const text = grandLivreRowsToAccountingText(rows);

    expect(text.split("\r\n")[0]).toContain("Compte");
    expect(text.split("\r\n")[0]).toContain("Débit origine");
    expect(text.split("\r\n")[0]).toContain("Crédit euro");
    expect(text).toContain("411000");
    expect(text).toContain("02/05/2026");
    expect(text).toContain("700,00");
    expect(text).toContain("2026");
  });
});
