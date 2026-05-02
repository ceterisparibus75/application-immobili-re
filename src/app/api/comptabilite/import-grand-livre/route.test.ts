import { describe, expect, it } from "vitest";
import { decodeTextBuffer, parseFec } from "./route";

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
});
