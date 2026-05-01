import { describe, expect, it } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getAnnualStatements } from "./annual-statements";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const FISCAL_YEAR_ID = "clh3x2z4k0001qh8g7z1y2v3u";

describe("getAnnualStatements", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();

    const result = await getAnnualStatements(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(false);
  });

  it("calcule bilan et compte de résultat simplifiés", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      year: 2026,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    } as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 0, account: { id: "bank", code: "512000", label: "Banque", type: "5" } },
      { debit: 0, credit: 1000, account: { id: "capital", code: "101000", label: "Capital", type: "1" } },
      { debit: 300, credit: 0, account: { id: "charges", code: "615100", label: "Entretien", type: "6" } },
      { debit: 0, credit: 500, account: { id: "products", code: "706100", label: "Loyers", type: "7" } },
    ] as never);

    const result = await getAnnualStatements(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(true);
    expect(result.data?.incomeStatement).toMatchObject({
      totalCharges: 300,
      totalProducts: 500,
      result: 200,
    });
    expect(result.data?.balanceSheet.assets).toEqual([
      expect.objectContaining({ code: "512000", amount: 1000 }),
    ]);
    expect(result.data?.balanceSheet.liabilities).toEqual([
      expect.objectContaining({ code: "101000", amount: 1000 }),
      expect.objectContaining({ code: "120000", amount: 200 }),
    ]);
    expect(result.data?.balanceSheet.balanced).toBe(false);
  });

  it("retourne une erreur si l'exercice est introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    const result = await getAnnualStatements(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result).toEqual({ success: false, error: "Exercice introuvable" });
  });
});
