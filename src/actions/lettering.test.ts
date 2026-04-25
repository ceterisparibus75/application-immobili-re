import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getNextLetteringCode, letterEntries, unletterEntries, getUnletteredEntries } from "./lettering";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const ACCOUNT_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const LINE_ID_1 = "clh3x2z4k0002qh8g7z1y2v3v";
const LINE_ID_2 = "clh3x2z4k0003qh8g7z1y2v3w";

function makeLine(overrides = {}) {
  return {
    id: LINE_ID_1,
    debit: 500,
    credit: 0,
    letteringCode: null,
    accountId: ACCOUNT_ID,
    ...overrides,
  };
}

describe("getNextLetteringCode", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne AA si aucun lettrage existant", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findFirst.mockResolvedValue(null);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.code).toBe("AA");
  });

  it("incrémente le code AA → AB", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findFirst.mockResolvedValue({ letteringCode: "AA" } as never);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.data?.code).toBe("AB");
  });

  it("incrémente AZ → BA", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findFirst.mockResolvedValue({ letteringCode: "AZ" } as never);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.data?.code).toBe("BA");
  });

  it("incrémente ZZ → AZZ (ajoute un caractère)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findFirst.mockResolvedValue({ letteringCode: "ZZ" } as never);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.data?.code).toBe("AAA");
  });

  it("retourne ForbiddenError si rôle insuffisant pour getNextLetteringCode (lignes 48-49)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si la BDD échoue dans getNextLetteringCode (lignes 51-52)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la generation du code de lettrage" });
  });
});

describe("letterEntries", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si moins de 2 lignes", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await letterEntries(SOCIETY_ID, ["line-1"]);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si lignes introuvables", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([makeLine()] as never);

    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvables/);
  });

  it("retourne une erreur si lignes déjà lettrées", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      makeLine({ letteringCode: "AA" }),
      makeLine({ id: LINE_ID_2, letteringCode: "AA" }),
    ] as never);

    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/deja lettree/);
  });

  it("retourne une erreur si débit ≠ crédit", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      makeLine({ debit: 1000, credit: 0 }),
      makeLine({ id: LINE_ID_2, debit: 0, credit: 500 }),
    ] as never);

    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Desequilibre/);
  });

  it("lette les lignes équilibrées avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      makeLine({ debit: 500, credit: 0 }),
      makeLine({ id: LINE_ID_2, debit: 0, credit: 500 }),
    ] as never);
    prismaMock.journalEntryLine.findFirst.mockResolvedValue(null); // getNextLetteringCode → AA
    prismaMock.journalEntryLine.updateMany.mockResolvedValue({ count: 2 } as never);

    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(true);
    expect(result.data?.letteringCode).toBe("AA");
    expect(prismaMock.journalEntryLine.updateMany).toHaveBeenCalled();
  });

  it("retourne une erreur si rôle insuffisant pour letterEntries", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans letterEntries", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result).toEqual({ success: false, error: "Erreur lors du lettrage" });
  });

  it("retourne une erreur si getNextLetteringCode échoue (ligne 141)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      makeLine({ debit: 500, credit: 0 }),
      makeLine({ id: LINE_ID_2, debit: 0, credit: 500 }),
    ] as never);
    prismaMock.journalEntryLine.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Impossible de generer/);
  });
});

describe("unletterEntries", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await unletterEntries(SOCIETY_ID, "AA");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si code invalide (< 2 chars)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await unletterEntries(SOCIETY_ID, "A");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si aucune ligne trouvée avec ce code", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([] as never);

    const result = await unletterEntries(SOCIETY_ID, "AA");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Aucune ligne/);
  });

  it("délette les lignes avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([{ id: "line-1" }] as never);
    prismaMock.journalEntryLine.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await unletterEntries(SOCIETY_ID, "AA");
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { letteringCode: null, letteredAt: null } })
    );
  });

  it("retourne une erreur si rôle insuffisant pour unletterEntries", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await unletterEntries(SOCIETY_ID, "AA");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans unletterEntries", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await unletterEntries(SOCIETY_ID, "AA");
    expect(result).toEqual({ success: false, error: "Erreur lors du delettrage" });
  });
});

describe("getUnletteredEntries", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getUnletteredEntries(SOCIETY_ID, ACCOUNT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne les lignes non lettrées", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: "line-1",
        debit: 800,
        credit: 0,
        label: "Loyer",
        journalEntry: { entryDate: new Date("2025-01-15"), piece: "FAC-001", label: "Facture janvier" },
      },
    ] as never);

    const result = await getUnletteredEntries(SOCIETY_ID, ACCOUNT_ID);
    expect(result.success).toBe(true);
    expect(result.data?.lines).toHaveLength(1);
    expect(result.data?.lines[0].debit).toBe(800);
    expect(result.data?.lines[0].entryLabel).toBe("Facture janvier");
  });

  it("retourne une erreur de validation si l'accountId est invalide", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await getUnletteredEntries(SOCIETY_ID, "not-a-cuid");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur si rôle insuffisant pour getUnletteredEntries", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await getUnletteredEntries(SOCIETY_ID, ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans getUnletteredEntries", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await getUnletteredEntries(SOCIETY_ID, ACCOUNT_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la recuperation des lignes non lettrees" });
  });
});
