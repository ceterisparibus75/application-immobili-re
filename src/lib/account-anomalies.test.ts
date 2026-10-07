import { describe, expect, it } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { detectAccountAnomalies } from "./account-anomalies";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const FISCAL_YEAR_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const ACCOUNT_ID = "clh3x2z4k0002qh8g7z1y2v3v";

function mockFiscalYear() {
  prismaMock.fiscalYear.findFirst.mockResolvedValue({
    id: FISCAL_YEAR_ID,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  } as never);
}

function mockAccount(overrides: Partial<{ code: string; label: string; sensNormal: "DEBIT" | "CREDIT" | null }> = {}) {
  prismaMock.accountingAccount.findFirst.mockResolvedValue({
    id: ACCOUNT_ID,
    code: overrides.code ?? "411000",
    label: overrides.label ?? "Locataires",
    sensNormal: overrides.sensNormal ?? null,
  } as never);
}

describe("detectAccountAnomalies", () => {
  it("retourne [] si le compte est introuvable", async () => {
    prismaMock.accountingAccount.findFirst.mockResolvedValue(null as never);
    mockFiscalYear();

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toEqual([]);
  });

  it("retourne [] si l'exercice est introuvable", async () => {
    mockAccount();
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toEqual([]);
  });

  it("ne détecte rien sur un compte équilibré, lettré et sans pièce en doublon", async () => {
    mockAccount({ code: "411000" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 1000, credit: 1000 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValue(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toEqual([]);
  });

  it("flagge UNLETTERED_LINES sur un compte de classe 4 avec des lignes mouvementées non lettrées", async () => {
    mockAccount({ code: "411000" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 1200, credit: 1200 },
    } as never);
    // 1er count = unlettered, 2e = negatif
    prismaMock.journalEntryLine.count.mockResolvedValueOnce(3 as never).mockResolvedValueOnce(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toContainEqual(
      expect.objectContaining({ type: "UNLETTERED_LINES", severity: "HIGH" })
    );
  });

  it("ignore UNLETTERED_LINES pour les comptes hors classe 4", async () => {
    mockAccount({ code: "706100" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 0, credit: 12000 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValueOnce(0 as never).mockResolvedValueOnce(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result.find((a) => a.type === "UNLETTERED_LINES")).toBeUndefined();
    // Pas de BALANCE_MISMATCH non plus (classe 7 n'est pas un compte de bilan).
    expect(result.find((a) => a.type === "BALANCE_MISMATCH")).toBeUndefined();
  });

  it("flagge BALANCE_MISMATCH en CRITICAL sur un compte de bilan non équilibré", async () => {
    mockAccount({ code: "411000" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 1200, credit: 1000 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValue(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toContainEqual(
      expect.objectContaining({ type: "BALANCE_MISMATCH", severity: "CRITICAL" })
    );
  });

  it("flagge NEGATIVE_AMOUNTS si une ligne est négative", async () => {
    mockAccount({ code: "411000" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 1000, credit: 1000 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValueOnce(0 as never).mockResolvedValueOnce(2 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toContainEqual(
      expect.objectContaining({ type: "NEGATIVE_AMOUNTS", severity: "HIGH" })
    );
  });

  it("flagge DUPLICATE_PIECES quand plusieurs écritures partagent le même numéro", async () => {
    mockAccount({ code: "411000" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 1000, credit: 1000 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValue(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([
      { piece: "FAC-001" },
      { piece: "FAC-001" },
      { piece: "FAC-002" },
    ] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    const dup = result.find((a) => a.type === "DUPLICATE_PIECES");
    expect(dup).toBeDefined();
    expect(dup?.message).toMatch(/FAC-001/);
  });

  it("flagge WRONG_SENS quand le solde contredit sensNormal", async () => {
    mockAccount({ code: "411000", sensNormal: "DEBIT" });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 500, credit: 800 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValue(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result).toContainEqual(
      expect.objectContaining({ type: "WRONG_SENS", severity: "MEDIUM" })
    );
  });

  it("ne flagge pas WRONG_SENS si sensNormal n'est pas renseigné", async () => {
    mockAccount({ code: "411000", sensNormal: null });
    mockFiscalYear();
    prismaMock.journalEntryLine.aggregate.mockResolvedValue({
      _sum: { debit: 500, credit: 800 },
    } as never);
    prismaMock.journalEntryLine.count.mockResolvedValue(0 as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await detectAccountAnomalies(SOCIETY_ID, ACCOUNT_ID, FISCAL_YEAR_ID);

    expect(result.find((a) => a.type === "WRONG_SENS")).toBeUndefined();
  });
});
