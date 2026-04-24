import { describe, it, expect } from "vitest";
import { createFiscalYearSchema, createJournalEntrySchema, journalEntryLineSchema } from "./accounting";

describe("createFiscalYearSchema", () => {
  it("accepte une année fiscale valide", () => {
    const result = createFiscalYearSchema.safeParse({ year: 2025, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result.success).toBe(true);
  });

  it("rejette une année < 2000", () => {
    const result = createFiscalYearSchema.safeParse({ year: 1999, startDate: "1999-01-01", endDate: "1999-12-31" });
    expect(result.success).toBe(false);
  });

  it("rejette une année > 2100", () => {
    const result = createFiscalYearSchema.safeParse({ year: 2101, startDate: "2101-01-01", endDate: "2101-12-31" });
    expect(result.success).toBe(false);
  });

  it("rejette une année non entière", () => {
    const result = createFiscalYearSchema.safeParse({ year: 2025.5, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result.success).toBe(false);
  });

  it("rejette startDate vide", () => {
    const result = createFiscalYearSchema.safeParse({ year: 2025, startDate: "", endDate: "2025-12-31" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Date de début requise/);
    }
  });

  it("rejette endDate vide", () => {
    const result = createFiscalYearSchema.safeParse({ year: 2025, startDate: "2025-01-01", endDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Date de fin requise/);
    }
  });
});

describe("journalEntryLineSchema", () => {
  it("accepte une ligne valide", () => {
    expect(journalEntryLineSchema.safeParse({ accountId: "512000", debit: 1000, credit: 0 }).success).toBe(true);
  });

  it("rejette accountId vide", () => {
    const result = journalEntryLineSchema.safeParse({ accountId: "", debit: 0, credit: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Compte requis/);
    }
  });

  it("rejette un débit négatif", () => {
    const result = journalEntryLineSchema.safeParse({ accountId: "512000", debit: -1, credit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejette un crédit négatif", () => {
    const result = journalEntryLineSchema.safeParse({ accountId: "512000", debit: 0, credit: -0.01 });
    expect(result.success).toBe(false);
  });

  it("debit et credit valent 0 par défaut", () => {
    const result = journalEntryLineSchema.safeParse({ accountId: "512000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.debit).toBe(0);
      expect(result.data.credit).toBe(0);
    }
  });

  it("rejette un libellé trop long (> 255 chars)", () => {
    const result = journalEntryLineSchema.safeParse({
      accountId: "512000",
      label: "X".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

describe("createJournalEntrySchema", () => {
  const validLine = { accountId: "512000", debit: 1000, credit: 0 };
  const validLine2 = { accountId: "411000", debit: 0, credit: 1000 };

  const validEntry = {
    journalType: "BQ",
    entryDate: "2025-06-01",
    label: "Virement loyer juin",
    lines: [validLine, validLine2],
  };

  it("accepte une écriture comptable valide", () => {
    expect(createJournalEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("rejette si journalType est vide", () => {
    const result = createJournalEntrySchema.safeParse({ ...validEntry, journalType: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Journal requis/);
    }
  });

  it("rejette si entryDate est vide", () => {
    const result = createJournalEntrySchema.safeParse({ ...validEntry, entryDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Date requise/);
    }
  });

  it("rejette si label est vide", () => {
    const result = createJournalEntrySchema.safeParse({ ...validEntry, label: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Libellé requis/);
    }
  });

  it("rejette si moins de 2 lignes", () => {
    const result = createJournalEntrySchema.safeParse({ ...validEntry, lines: [validLine] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Au moins 2 lignes requises/);
    }
  });

  it("accepte avec le champ piece optionnel", () => {
    const result = createJournalEntrySchema.safeParse({ ...validEntry, piece: "FAC-001" });
    expect(result.success).toBe(true);
  });

  it("rejette piece trop long (> 50 chars)", () => {
    const result = createJournalEntrySchema.safeParse({ ...validEntry, piece: "X".repeat(51) });
    expect(result.success).toBe(false);
  });
});
