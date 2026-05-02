import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  getNextLetteringCode,
  letterEntries,
  unletterEntries,
  getUnletteredEntries,
  getLetteredGroups,
  getLetteringSuggestions,
} from "./lettering";

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
    lettrage: null,
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
    prismaMock.journalEntryLine.findMany.mockResolvedValue([]);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.code).toBe("AA");
  });

  it("incrémente le code AA → AB", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([{ letteringCode: "AA", lettrage: null }] as never);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.data?.code).toBe("AB");
  });

  it("incrémente AZ → BA", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([{ letteringCode: "AZ", lettrage: null }] as never);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.data?.code).toBe("BA");
  });

  it("incrémente ZZ → AZZ (ajoute un caractère)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([{ letteringCode: "ZZ", lettrage: null }] as never);

    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.data?.code).toBe("AAA");
  });

  it("tient compte des anciens codes lettrage pour générer le prochain code", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { letteringCode: null, lettrage: "AB" },
      { letteringCode: "AC", lettrage: null },
    ] as never);

    const result = await getNextLetteringCode(SOCIETY_ID);

    expect(result.data?.code).toBe("AD");
  });

  it("retourne ForbiddenError si rôle insuffisant pour getNextLetteringCode (lignes 48-49)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await getNextLetteringCode(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si la BDD échoue dans getNextLetteringCode (lignes 51-52)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockRejectedValue(new Error("DB error"));
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

  it("retourne une erreur si une ligne a un ancien code lettrage", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      makeLine({ lettrage: "AA" }),
      makeLine({ id: LINE_ID_2, debit: 0, credit: 500 }),
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
    prismaMock.journalEntryLine.findMany
      .mockResolvedValueOnce([
        makeLine({ debit: 500, credit: 0 }),
        makeLine({ id: LINE_ID_2, debit: 0, credit: 500 }),
      ] as never)
      .mockResolvedValueOnce([] as never); // getNextLetteringCode -> AA
    prismaMock.journalEntryLine.updateMany.mockResolvedValue({ count: 2 } as never);

    const result = await letterEntries(SOCIETY_ID, [LINE_ID_1, LINE_ID_2]);
    expect(result.success).toBe(true);
    expect(result.data?.letteringCode).toBe("AA");
    expect(prismaMock.journalEntryLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ letteringCode: "AA", lettrage: "AA" }),
      })
    );
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
    prismaMock.journalEntryLine.findMany
      .mockResolvedValueOnce([
        makeLine({ debit: 500, credit: 0 }),
        makeLine({ id: LINE_ID_2, debit: 0, credit: 500 }),
      ] as never)
      .mockRejectedValueOnce(new Error("DB error"));
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
      expect.objectContaining({ data: { letteringCode: null, lettrage: null, letteredAt: null } })
    );
  });

  it("délette les lignes portant un ancien code lettrage", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([{ id: "line-legacy" }] as never);
    prismaMock.journalEntryLine.updateMany.mockResolvedValue({ count: 1 } as never);

    const result = await unletterEntries(SOCIETY_ID, "AB");

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ letteringCode: "AB" }, { lettrage: "AB" }],
        }),
      })
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
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ letteringCode: null, lettrage: null }),
      })
    );
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

describe("getLetteredGroups", () => {
  it("regroupe les lignes lettrées par code pour un compte", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: LINE_ID_1,
        debit: 500,
        credit: 0,
        letteringCode: "AA",
        letteredAt: new Date("2025-01-20"),
        journalEntry: { entryDate: new Date("2025-01-15"), piece: "FAC-001", label: "Facture janvier" },
      },
      {
        id: LINE_ID_2,
        debit: 0,
        credit: 500,
        letteringCode: "AA",
        letteredAt: new Date("2025-01-20"),
        journalEntry: { entryDate: new Date("2025-01-18"), piece: "PAY-001", label: "Paiement janvier" },
      },
    ] as never);

    const result = await getLetteredGroups(SOCIETY_ID, ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.groups).toEqual([
      {
        letteringCode: "AA",
        lineCount: 2,
        totalDebit: 500,
        totalCredit: 500,
        firstEntryDate: new Date("2025-01-15"),
        lastEntryDate: new Date("2025-01-18"),
        letteredAt: new Date("2025-01-20"),
        pieces: ["FAC-001", "PAY-001"],
      },
    ]);
  });

  it("regroupe les lignes lettrées avec l'ancien champ lettrage", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: LINE_ID_1,
        debit: 500,
        credit: 0,
        letteringCode: null,
        lettrage: "AB",
        letteredAt: null,
        journalEntry: { entryDate: new Date("2025-01-15"), piece: "FAC-001", label: "Facture janvier" },
      },
    ] as never);

    const result = await getLetteredGroups(SOCIETY_ID, ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.groups[0]).toEqual(expect.objectContaining({ letteringCode: "AB" }));
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ letteringCode: { not: null } }, { lettrage: { not: null } }],
        }),
      })
    );
  });

  it("retourne une erreur de validation si l'accountId est invalide", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);

    const result = await getLetteredGroups(SOCIETY_ID, "not-a-cuid");

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("getLetteringSuggestions", () => {
  it("propose des lettrages exacts debit-credit sur un compte", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: LINE_ID_1,
        debit: 500,
        credit: 0,
        label: "Facture janvier",
        journalEntry: { entryDate: new Date("2025-01-15"), piece: "FAC-001", label: "Facture janvier" },
      },
      {
        id: LINE_ID_2,
        debit: 0,
        credit: 500,
        label: "Paiement janvier",
        journalEntry: { entryDate: new Date("2025-01-20"), piece: "PAY-001", label: "Paiement janvier" },
      },
      {
        id: "clh3x2z4k0004qh8g7z1y2v3x",
        debit: 120,
        credit: 0,
        label: "Facture non reglee",
        journalEntry: { entryDate: new Date("2025-02-01"), piece: "FAC-002", label: "Facture fevrier" },
      },
    ] as never);

    const result = await getLetteringSuggestions(SOCIETY_ID, ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.suggestions).toEqual([
      expect.objectContaining({
        lineIds: [LINE_ID_1, LINE_ID_2],
        totalDebit: 500,
        totalCredit: 500,
        difference: 0,
        reason: "libellés proches, date proche",
      }),
    ]);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ letteringCode: null, lettrage: null }),
      })
    );
  });

  it("priorise la contrepartie avec référence commune et date proche", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const unrelatedCreditId = "clh3x2z4k0005qh8g7z1y2v3y";
    const matchingCreditId = "clh3x2z4k0006qh8g7z1y2v3z";
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: LINE_ID_1,
        debit: 500,
        credit: 0,
        label: "Facture FAC-2026-001",
        journalEntry: {
          entryDate: new Date("2026-01-10"),
          piece: "FAC-2026-001",
          reference: "BAIL-42",
          label: "Facture janvier",
        },
      },
      {
        id: unrelatedCreditId,
        debit: 0,
        credit: 500,
        label: "Paiement ancien sans référence",
        journalEntry: {
          entryDate: new Date("2025-11-01"),
          piece: "PAY-OLD",
          reference: null,
          label: "Paiement ancien",
        },
      },
      {
        id: matchingCreditId,
        debit: 0,
        credit: 500,
        label: "Paiement FAC-2026-001",
        journalEntry: {
          entryDate: new Date("2026-01-12"),
          piece: "PAY-2026-001",
          reference: "BAIL-42",
          label: "Paiement janvier FAC-2026-001",
        },
      },
    ] as never);

    const result = await getLetteringSuggestions(SOCIETY_ID, ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.suggestions[0]).toEqual(
      expect.objectContaining({
        lineIds: [LINE_ID_1, matchingCreditId],
        reason: "Référence commune, libellés proches, date proche",
      })
    );
  });

  it("propose un lettrage multi-paiements quand plusieurs crédits soldent un débit", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const creditId1 = "clh3x2z4k0007qh8g7z1y2v3a";
    const creditId2 = "clh3x2z4k0008qh8g7z1y2v3b";
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: LINE_ID_1,
        debit: 500,
        credit: 0,
        label: "Facture FAC-2026-004",
        journalEntry: {
          entryDate: new Date("2026-02-01"),
          piece: "FAC-2026-004",
          reference: "BAIL-42",
          label: "Facture février",
        },
      },
      {
        id: creditId1,
        debit: 0,
        credit: 300,
        label: "Paiement partiel FAC-2026-004",
        journalEntry: {
          entryDate: new Date("2026-02-05"),
          piece: "PAY-2026-004-A",
          reference: "BAIL-42",
          label: "Premier paiement février",
        },
      },
      {
        id: creditId2,
        debit: 0,
        credit: 200,
        label: "Solde FAC-2026-004",
        journalEntry: {
          entryDate: new Date("2026-02-12"),
          piece: "PAY-2026-004-B",
          reference: "BAIL-42",
          label: "Solde paiement février",
        },
      },
    ] as never);

    const result = await getLetteringSuggestions(SOCIETY_ID, ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.suggestions[0]).toEqual(
      expect.objectContaining({
        lineIds: [LINE_ID_1, creditId1, creditId2],
        totalDebit: 500,
        totalCredit: 500,
        difference: 0,
        reason: "Paiements cumulés",
      })
    );
  });

  it("propose un lettrage multi-factures quand un crédit solde plusieurs débits", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const debitId2 = "clh3x2z4k0009qh8g7z1y2v3c";
    const creditId = "clh3x2z4k0010qh8g7z1y2v3d";
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: LINE_ID_1,
        debit: 300,
        credit: 0,
        label: "Facture loyer février",
        journalEntry: {
          entryDate: new Date("2026-02-01"),
          piece: "FAC-2026-002",
          reference: "BAIL-42",
          label: "Facture février",
        },
      },
      {
        id: debitId2,
        debit: 200,
        credit: 0,
        label: "Facture charges février",
        journalEntry: {
          entryDate: new Date("2026-02-01"),
          piece: "FAC-2026-003",
          reference: "BAIL-42",
          label: "Charges février",
        },
      },
      {
        id: creditId,
        debit: 0,
        credit: 500,
        label: "Paiement global février",
        journalEntry: {
          entryDate: new Date("2026-02-08"),
          piece: "PAY-2026-002",
          reference: "BAIL-42",
          label: "Paiement février",
        },
      },
    ] as never);

    const result = await getLetteringSuggestions(SOCIETY_ID, ACCOUNT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.suggestions[0]).toEqual(
      expect.objectContaining({
        lineIds: [LINE_ID_1, debitId2, creditId],
        totalDebit: 500,
        totalCredit: 500,
        difference: 0,
        reason: "Factures cumulées",
      })
    );
  });

  it("retourne une erreur de validation si l'accountId est invalide", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);

    const result = await getLetteringSuggestions(SOCIETY_ID, "not-a-cuid");

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
