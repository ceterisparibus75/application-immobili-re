import { describe, expect, it } from "vitest";
import { decodeTextBuffer, parseFec, parseGrandLivreText } from "./route";

const fecRows = [
  "JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tPieceRef\tEcritureLib\tDebit\tCredit",
  "BQ\tBanque\tECR1\t20260430\t512100\tBanque principale\tP1\tVirement reçu\t100,00\t",
  "BQ\tBanque\tECR1\t20260430\t411100\tClient locataire\tP1\tVirement reçu\t\t100,00",
];

describe("import-grand-livre FEC parser", () => {
  it("parse un FEC txt UTF-16LE avec fins de ligne CRLF", () => {
    const buffer = Buffer.from(`\uFEFF${fecRows.join("\r\n")}`, "utf16le");
    const entries = parseFec(decodeTextBuffer(buffer));

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      journalCode: "BQ",
      entryDate: "2026-04-30",
      piece: "P1",
      label: "Virement reçu",
      totalDebit: 100,
      totalCredit: 100,
      isBalanced: true,
    });
    expect(entries[0]?.lines).toHaveLength(2);
  });

  it("parse un FEC txt avec fins de ligne CR seules", () => {
    const entries = parseFec(fecRows.join("\r"));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.totalDebit).toBe(100);
    expect(entries[0]?.totalCredit).toBe(100);
  });

  it("parse un export grand-livre texte à colonnes fixes", () => {
    const text = [
      "Compte        Libellé compte                                     Journal  Date écriture Pièce            Libellé écriture                                   Débit origine Crédit origine Débit euro  Crédit euro  Lettrage N Lettrage N+1 Lettrage partiel Révision Année      Mois       Jour       Monnaie ISO Monnaie Taux change Type règlement Quantité 1 Unité 1    Quantité 2 Unité 2 ",
      "164100        PRET 82 000 €                                      INV      20/01/2026    2601-REMP-000001 Emprunts échus - Capital 40004822RAIM11AQ          459,16        0              459,16      0                       Faux         Faux             N        2026       1          20         E                   1           R              0                     0                  ",
      "512100        BANQUE                                             INV      20/01/2026    2601-REMP-000001 Emprunts échus - Capital 40004822RAIM11AQ          0             459,16         0           459,16                  Faux         Faux             N        2026       1          20         E                   1           R              0                     0                  ",
    ].join("\r\n");

    const entries = parseGrandLivreText(text);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      journalCode: "INV",
      entryDate: "2026-01-20",
      piece: "2601-REMP-000001",
      label: "Emprunts échus - Capital 40004822RAIM11AQ",
      totalDebit: 459.16,
      totalCredit: 459.16,
      isBalanced: true,
    });
    expect(entries[0]?.lines).toEqual([
      { accountCode: "164100", accountLabel: "PRET 82 000 €", debit: 459.16, credit: 0 },
      { accountCode: "512100", accountLabel: "BANQUE", debit: 0, credit: 459.16 },
    ]);
  });

  it("conserve les comptes auxiliaires alphanumériques d'un grand-livre texte", () => {
    const text = [
      "Compte        Libellé compte                                     Journal  Date écriture Pièce            Libellé écriture                                   Débit origine Crédit origine Débit euro  Crédit euro  Lettrage N Lettrage N+1 Lettrage partiel Révision Année      Mois       Jour       Monnaie ISO Monnaie Taux change Type règlement Quantité 1 Unité 1    Quantité 2 Unité 2 ",
      "164100        PRET 82 000 €                                      INV      20/01/2026    2601-REMP-000001 Emprunts échus - Capital 40004822RAIM11AQ          459,16        0              459,16      0                       Faux         Faux             N        2026       1          20         E                   1           R              0                     0                  ",
      "661600        INTERETS EMPRUNT                                   INV      20/01/2026    2601-REMP-000001 Intérêts des emprunts 40004822RAIM11AQ             40,67         0              40,67       0                       Faux         Faux             N        2026       1          20         E                   1           R              0                     0                  ",
      "FEMPRUNT      EMPRUNT                                            INV      20/01/2026    2601-REMP-000001 Emprunts échus - Echéance 40004822RAIM11AQ         0             499,83         0           499,83       DL         Faux         Faux             N        2026       1          20         E                   1           R              0                     0                  ",
    ].join("\r\n");

    const entries = parseGrandLivreText(text);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      totalDebit: 499.83,
      totalCredit: 499.83,
      isBalanced: true,
    });
    expect(entries[0]?.lines.map((line) => line.accountCode)).toEqual([
      "164100",
      "661600",
      "FEMPRUNT",
    ]);
  });

  it("ajoute une contrepartie 471000 sur les écritures grand-livre isolées", () => {
    const text = [
      "Compte        Libellé compte                                     Journal  Date écriture Pièce            Libellé écriture                                   Débit origine Crédit origine Débit euro  Crédit euro  Lettrage N Lettrage N+1 Lettrage partiel Révision Année      Mois       Jour       Monnaie ISO Monnaie Taux change Type règlement Quantité 1 Unité 1    Quantité 2 Unité 2 ",
      "119000        REPORT A NOUVEAU DEBITEUR                          AN       01/01/2026                     Solde à nouveau                                    98422,97      0              98422,97    0                       Faux         Faux             N        2026       1          1          E                   1           R              0                     0                  ",
    ].join("\r\n");

    const entries = parseGrandLivreText(text);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      totalDebit: 98422.97,
      totalCredit: 98422.97,
      isBalanced: true,
    });
    expect(entries[0]?.lines.at(-1)).toEqual({
      accountCode: "471000",
      accountLabel: "Compte d'attente import grand livre",
      debit: 0,
      credit: 98422.97,
    });
  });

  it("parse un export grand-livre CSV avec les colonnes débit/crédit euro", () => {
    const text = [
      "Compte;Libellé compte;Journal;Date écriture;Pièce;Libellé écriture;Débit origine;Crédit origine;Débit euro;Crédit euro;Lettrage N",
      "164100;PRET 82 000 €;INV;20/01/2026;2601-REMP-000001;Emprunts échus - Capital 40004822RAIM11AQ;459,16;0;459,16;0;",
      "512100;BANQUE;INV;20/01/2026;2601-REMP-000001;Emprunts échus - Capital 40004822RAIM11AQ;0;459,16;0;459,16;",
    ].join("\n");

    const entries = parseFec(text);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      journalCode: "INV",
      entryDate: "2026-01-20",
      totalDebit: 459.16,
      totalCredit: 459.16,
      isBalanced: true,
    });
    expect(entries[0]?.lines[0]).toMatchObject({
      accountCode: "164100",
      accountLabel: "PRET 82 000 €",
      debit: 459.16,
    });
  });
});
