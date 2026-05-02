import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getJournalSummary } from "./accounting-journals";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("getJournalSummary", () => {
  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
  });

  it("retourne une erreur si l'utilisateur n'est pas authentifié", async () => {
    mockUnauthenticated();

    const result = await getJournalSummary(SOCIETY_ID);

    expect(result.success).toBe(false);
  });

  it("agrège les écritures par journal", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([
      {
        journalType: "VT",
        entryDate: new Date("2025-01-15"),
        status: "VALIDEE",
        lines: [
          { debit: 1000, credit: 0 },
          { debit: 0, credit: 1000 },
        ],
      },
      {
        journalType: "VT",
        entryDate: new Date("2025-01-20"),
        status: "BROUILLON",
        lines: [
          { debit: 200, credit: 0 },
          { debit: 0, credit: 200 },
        ],
      },
      {
        journalType: "BQUE",
        entryDate: new Date("2025-02-01"),
        status: "CLOTUREE",
        lines: [
          { debit: 300, credit: 0 },
          { debit: 0, credit: 300 },
        ],
      },
    ] as never);

    const result = await getJournalSummary(SOCIETY_ID);

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({
        journalType: "BQUE",
        entryCount: 1,
        closedCount: 1,
        totalDebit: 300,
        totalCredit: 300,
        balanced: true,
      }),
      expect.objectContaining({
        journalType: "VT",
        entryCount: 2,
        lineCount: 4,
        draftCount: 1,
        validatedCount: 1,
        totalDebit: 1200,
        totalCredit: 1200,
        balanced: true,
      }),
    ]);
  });

  it("regroupe les anciens codes journaux avec les codes canoniques", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([
      {
        journalType: "VENTES",
        entryDate: new Date("2025-01-15"),
        status: "VALIDEE",
        lines: [
          { debit: 1000, credit: 0 },
          { debit: 0, credit: 1000 },
        ],
      },
      {
        journalType: "VT",
        entryDate: new Date("2025-01-20"),
        status: "VALIDEE",
        lines: [
          { debit: 200, credit: 0 },
          { debit: 0, credit: 200 },
        ],
      },
      {
        journalType: "BANQUE",
        entryDate: new Date("2025-02-01"),
        status: "BROUILLON",
        lines: [
          { debit: 300, credit: 0 },
          { debit: 0, credit: 300 },
        ],
      },
    ] as never);

    const result = await getJournalSummary(SOCIETY_ID);

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({
        journalType: "BQUE",
        entryCount: 1,
        draftCount: 1,
        totalDebit: 300,
      }),
      expect.objectContaining({
        journalType: "VT",
        entryCount: 2,
        validatedCount: 2,
        totalDebit: 1200,
      }),
    ]);
  });

  it("filtre par exercice fiscal", async () => {
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
    } as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await getJournalSummary(SOCIETY_ID, { fiscalYearId: "fy-2025" });

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: SOCIETY_ID,
          entryDate: {
            gte: new Date("2025-01-01"),
            lte: new Date("2025-12-31"),
          },
        }),
      })
    );
  });

  it("retourne une erreur si l'exercice fiscal est introuvable", async () => {
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    const result = await getJournalSummary(SOCIETY_ID, { fiscalYearId: "missing" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });
});
