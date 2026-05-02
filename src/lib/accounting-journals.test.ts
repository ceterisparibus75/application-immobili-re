import { describe, expect, it } from "vitest";

import {
  ACCOUNTING_JOURNAL_LABELS,
  CANONICAL_ACCOUNTING_JOURNAL_TYPES,
  getAccountingJournalTypeAliases,
  normalizeAccountingJournalType,
} from "./accounting-journals";

describe("accounting journal referential", () => {
  it("expose la liste canonique des journaux de saisie", () => {
    expect(CANONICAL_ACCOUNTING_JOURNAL_TYPES).toEqual(["AN", "AC", "VT", "BQUE", "OD", "INV"]);
  });

  it("normalise les anciens codes vers les codes canoniques", () => {
    expect(normalizeAccountingJournalType("VENTES")).toBe("VT");
    expect(normalizeAccountingJournalType("BANQUE")).toBe("BQUE");
    expect(normalizeAccountingJournalType("OPERATIONS_DIVERSES")).toBe("OD");
  });

  it("fournit les alias legacy pour les filtres", () => {
    expect(getAccountingJournalTypeAliases("BQUE")).toEqual(["BQUE", "BANQUE"]);
  });

  it("fournit les libellés partagés", () => {
    expect(ACCOUNTING_JOURNAL_LABELS.BQUE).toBe("Banque");
    expect(ACCOUNTING_JOURNAL_LABELS.VENTES).toBe("Ventes / TVA");
  });
});
