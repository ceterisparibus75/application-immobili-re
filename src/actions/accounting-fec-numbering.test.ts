import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { assignFecNumbersToFiscalYear } from "./accounting-fec-numbering";
import { formatFecEcritureNum } from "@/lib/fec-numbering";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const FISCAL_YEAR_ID = "clh3x2z4k0001qh8g7z1y2v3u";

function makeFiscalYear(overrides: Record<string, unknown> = {}) {
  return {
    id: FISCAL_YEAR_ID,
    year: 2025,
    ...overrides,
  };
}

function makeEntry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    fecEcritureNum: null,
    ...overrides,
  };
}

describe("formatFecEcritureNum", () => {
  it("zero-padde sur 8 chiffres", () => {
    expect(formatFecEcritureNum(1)).toBe("00000001");
    expect(formatFecEcritureNum(42)).toBe("00000042");
    expect(formatFecEcritureNum(99999999)).toBe("99999999");
  });
});

describe("assignFecNumbersToFiscalYear", () => {
  beforeEach(() => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear() as never);
  });

  it("echoue si non authentifie", async () => {
    mockUnauthenticated();
    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
  });

  it("echoue si l'exercice n'existe pas pour cette societe", async () => {
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);
    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result).toEqual({ success: false, error: expect.stringContaining("introuvable") });
  });

  it("attribue des numeros sequentiels 1..N sur les entries validees non numerotees", async () => {
    const entries = [
      makeEntry("e1"),
      makeEntry("e2"),
      makeEntry("e3"),
    ];
    prismaMock.journalEntry.findMany.mockResolvedValue(entries as never);

    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      assigned: 3,
      skipped: 0,
      alreadyNumbered: false,
    });

    // 1 update par entry, dans l'ordre
    expect(prismaMock.journalEntry.update).toHaveBeenCalledTimes(3);
    expect(prismaMock.journalEntry.update).toHaveBeenNthCalledWith(1, {
      where: { id: "e1" },
      data: { fecEcritureNum: "00000001" },
    });
    expect(prismaMock.journalEntry.update).toHaveBeenNthCalledWith(2, {
      where: { id: "e2" },
      data: { fecEcritureNum: "00000002" },
    });
    expect(prismaMock.journalEntry.update).toHaveBeenNthCalledWith(3, {
      where: { id: "e3" },
      data: { fecEcritureNum: "00000003" },
    });

    // La requete filtre bien par exercice + validatedOnly + ordre canonique
    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: SOCIETY_ID, fiscalYearId: FISCAL_YEAR_ID, isValidated: true },
        orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      })
    );
  });

  it("est idempotent : no-op si toutes les entries sont deja numerotees", async () => {
    const entries = [
      makeEntry("e1", { fecEcritureNum: "00000001" }),
      makeEntry("e2", { fecEcritureNum: "00000002" }),
    ];
    prismaMock.journalEntry.findMany.mockResolvedValue(entries as never);

    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      assigned: 0,
      skipped: 2,
      alreadyNumbered: true,
    });
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });

  it("retourne 0 entries pour un exercice sans ecritures validees", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      assigned: 0,
      skipped: 0,
      alreadyNumbered: false,
    });
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });

  it("refuse une numerotation partielle sans force (securite anti-corruption)", async () => {
    const entries = [
      makeEntry("e1", { fecEcritureNum: "00000001" }),
      makeEntry("e2"),
      makeEntry("e3"),
    ];
    prismaMock.journalEntry.findMany.mockResolvedValue(entries as never);

    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toMatch(/partielle/i);
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });

  it("re-attribue l'ensemble si force=true (correctif admin avant cloture)", async () => {
    const entries = [
      makeEntry("e1", { fecEcritureNum: "00000001" }),
      makeEntry("e2", { fecEcritureNum: "00000002" }),
    ];
    prismaMock.journalEntry.findMany.mockResolvedValue(entries as never);

    const result = await assignFecNumbersToFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID, {
      force: true,
    });

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntry.update).toHaveBeenCalledTimes(2);
  });
});
