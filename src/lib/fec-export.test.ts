import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/fec-export", async (importOriginal) => {
  return await importOriginal();
});

import { prismaMock } from "@/test/mocks/prisma";
import { generateFec } from "./fec-export";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    societyId: SOCIETY_ID,
    journalType: "VENTES",
    entryDate: new Date("2025-01-15T00:00:00.000Z"),
    piece: "FAC-001",
    label: "Vente loyer janvier",
    isValidated: true,
    createdAt: new Date("2025-01-15T00:00:00.000Z"),
    lines: [
      {
        id: "line-1",
        debit: 1000,
        credit: 0,
        label: "Loyer",
        letteringCode: null,
        lettrage: null,
        letteredAt: null,
        account: { code: "411000", label: "Clients" },
      },
      {
        id: "line-2",
        debit: 0,
        credit: 1000,
        label: "Produit loyer",
        letteringCode: null,
        lettrage: null,
        letteredAt: null,
        account: { code: "706000", label: "Produits des activités annexes" },
      },
    ],
    ...overrides,
  };
}

describe("generateFec", () => {
  beforeEach(() => {
    prismaMock.society.findUnique.mockResolvedValue({
      siret: "123 456 789 00012",
    } as never);
    prismaMock.fiscalYear.findUnique.mockResolvedValue(null as never);
  });

  it("retourne un contenu FEC avec en-tête et lignes", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.content).toContain("JournalCode\t");
    expect(result.content).toContain("VT\t");
    expect(result.content).toContain("FAC-001");
    expect(result.lineCount).toBe(2); // 2 lignes de données
  });

  it("génère le bon nom de fichier à partir du SIRET", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);

    const result = await generateFec(SOCIETY_ID, { year: 2025 });

    // SIREN = 9 premiers chiffres du SIRET sans espaces
    expect(result.filename).toContain("123456789");
    expect(result.filename).toContain("FEC");
    expect(result.filename).toContain("20251231");
    expect(result.filename.endsWith(".txt")).toBe(true);
  });

  it("retourne stats équilibrées si débit = crédit", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.stats.totalDebit).toBe(1000);
    expect(result.stats.totalCredit).toBe(1000);
    expect(result.stats.balanced).toBe(true);
    expect(result.stats.totalEntries).toBe(1);
    expect(result.anomalies).toHaveLength(0);
  });

  it("détecte une anomalie si l'écriture n'a pas de lignes", async () => {
    const emptyEntry = makeEntry({ lines: [] });
    prismaMock.journalEntry.findMany.mockResolvedValue([emptyEntry] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].severity).toBe("error");
    expect(result.anomalies[0].message).toMatch(/sans lignes/);
  });

  it("détecte une anomalie si l'écriture est déséquilibrée", async () => {
    const unbalanced = makeEntry({
      lines: [
        { id: "l1", debit: 1000, credit: 0, label: "A", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "411", label: "Clients" } },
        { id: "l2", debit: 0, credit: 500, label: "B", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "706", label: "Produit" } },
      ],
    });
    prismaMock.journalEntry.findMany.mockResolvedValue([unbalanced] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.anomalies.some((a) => a.message.includes("desequilibr"))).toBe(true);
  });

  it("retourne contenu vide si aucune écriture", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.lineCount).toBe(0);
    expect(result.stats.totalEntries).toBe(0);
    expect(result.stats.balanced).toBe(true);
    expect(result.anomalies).toHaveLength(0);
  });

  it("utilise SIREN par défaut 000000000 si société sans SIRET", async () => {
    prismaMock.society.findUnique.mockResolvedValue({ siret: null } as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    const result = await generateFec(SOCIETY_ID, { year: 2025 });

    expect(result.filename).toContain("000000000");
  });

  it("le contenu utilise CRLF comme séparateur de lignes", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.content).toContain("\r\n");
  });

  it("filtre par exercice fiscal si fiscalYearId est fourni (lignes 92-96, 105-108, 242)", async () => {
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      year: 2025,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
    } as never);
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);

    const result = await generateFec(SOCIETY_ID, { fiscalYearId: "fiscal-1" });

    expect(prismaMock.fiscalYear.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "fiscal-1", societyId: SOCIETY_ID } })
    );
    expect(result.filename).toContain("20251231");
  });

  it("filtre validatedOnly si l'option est activée (ligne 101)", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);

    await generateFec(SOCIETY_ID, { validatedOnly: true });

    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isValidated: true }),
      })
    );
  });

  it("filtre par dateFrom/dateTo si fournis (ligne 115)", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    await generateFec(SOCIETY_ID, {
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-06-30"),
    });

    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entryDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it("filtre par journalType si fourni (ligne 122)", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    await generateFec(SOCIETY_ID, { journalType: "VENTES" });

    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ journalType: { in: ["VT", "VENTES"] } }),
      })
    );
  });

  it("inclut les anciens codes quand le filtre journal canonique est fourni", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([] as never);

    await generateFec(SOCIETY_ID, { journalType: "BQUE" });

    expect(prismaMock.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalType: { in: ["BQUE", "BANQUE"] },
        }),
      })
    );
  });

  it("détecte une anomalie si l'écriture contient des montants négatifs (ligne 178)", async () => {
    const negativeEntry = makeEntry({
      lines: [
        { id: "l1", debit: -100, credit: 0, label: "A", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "411", label: "Clients" } },
        { id: "l2", debit: 0, credit: -100, label: "B", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "706", label: "Produit" } },
      ],
    });
    prismaMock.journalEntry.findMany.mockResolvedValue([negativeEntry] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.anomalies.some((a) => a.message.includes("negatif"))).toBe(true);
  });

  it("utilise letteringCode si présent sur la ligne", async () => {
    const entryWithLettrage = makeEntry({
      lines: [
        {
          id: "l1",
          debit: 500,
          credit: 0,
          label: "Loyer",
          letteringCode: "AA",
          lettrage: null,
          letteredAt: new Date("2025-01-20"),
          account: { code: "411", label: "Client" },
        },
        {
          id: "l2",
          debit: 0,
          credit: 500,
          label: "Produit",
          letteringCode: null,
          lettrage: null,
          letteredAt: null,
          account: { code: "706", label: "Produit" },
        },
      ],
    });
    prismaMock.journalEntry.findMany.mockResolvedValue([entryWithLettrage] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.content).toContain("\tAA\t");
  });

  it("utilise lettrage si letteringCode absent mais lettrage présent (B21 arm0)", async () => {
    const entry = makeEntry({
      lines: [
        { id: "l1", debit: 300, credit: 0, label: "Loyer", letteringCode: null, lettrage: "BB", letteredAt: null, account: { code: "411", label: "Client" } },
        { id: "l2", debit: 0, credit: 300, label: "Produit", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "706", label: "Produit" } },
      ],
    });
    prismaMock.journalEntry.findMany.mockResolvedValue([entry] as never);
    const result = await generateFec(SOCIETY_ID);
    expect(result.content).toContain("\tBB\t");
  });

  it("fallbacks: journalType inconnu, isValidated=false, piece=null, label=null sur ligne (B11/B17/B18/B19/B23 arm1)", async () => {
    const entry = makeEntry({
      journalType: "INCONNU_TYPE",
      isValidated: false,
      piece: null,
      label: "Entrée label",
      lines: [
        { id: "l1", debit: 200, credit: 0, label: null, letteringCode: null, lettrage: null, letteredAt: null, account: { code: "411", label: "Client" } },
        { id: "l2", debit: 0, credit: 200, label: "Produit", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "706", label: "Produit" } },
      ],
    });
    prismaMock.journalEntry.findMany.mockResolvedValue([entry] as never);
    const result = await generateFec(SOCIETY_ID);
    // journalType inconnu → code = slice 0-3 = "INC" (B11 arm1)
    expect(result.content).toContain("INC");
    // isValidated=false → ValidDate="" (B17 arm1)
    // piece=null → pieceRef="" (B18 arm1)
    // label null sur l1 → line.label ?? entry.label = "Entrée label" (B19 arm1)
    expect(result.content).toContain("Entrée label");
  });

  it("signale les pièces manquantes, écritures non validées et lignes incohérentes", async () => {
    const entry = makeEntry({
      isValidated: false,
      piece: null,
      lines: [
        { id: "l1", debit: 100, credit: 100, label: "Double montant", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "411", label: "Client" } },
        { id: "l2", debit: 0, credit: 0, label: "Sans montant", letteringCode: null, lettrage: null, letteredAt: null, account: { code: "706", label: "Produit" } },
      ],
    });
    prismaMock.journalEntry.findMany.mockResolvedValue([entry] as never);

    const result = await generateFec(SOCIETY_ID);

    expect(result.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warning", message: expect.stringContaining("sans reference de piece") }),
        expect.objectContaining({ severity: "warning", message: expect.stringContaining("non validee") }),
        expect.objectContaining({ severity: "error", message: expect.stringContaining("debit et credit") }),
        expect.objectContaining({ severity: "error", message: expect.stringContaining("sans montant") }),
      ])
    );
  });

  it("filtre avec dateFrom uniquement (B8 arm0, B9 arm1: pas de dateTo)", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);
    await generateFec(SOCIETY_ID, { dateFrom: new Date("2025-01-01") });
    const callArgs = prismaMock.journalEntry.findMany.mock.calls[0][0] as { where?: { entryDate?: { gte?: Date; lte?: Date } } };
    expect(callArgs.where?.entryDate?.gte).toBeDefined(); // dateFrom set
    expect(callArgs.where?.entryDate?.lte).toBeUndefined(); // no dateTo
  });

  it("filtre avec dateTo uniquement (B8 arm1: pas de dateFrom, B9 arm0)", async () => {
    prismaMock.journalEntry.findMany.mockResolvedValue([makeEntry()] as never);
    await generateFec(SOCIETY_ID, { dateTo: new Date("2025-12-31") });
    const callArgs = prismaMock.journalEntry.findMany.mock.calls[0][0] as { where?: { entryDate?: { gte?: Date; lte?: Date } } };
    expect(callArgs.where?.entryDate?.lte).toBeDefined(); // dateTo set
    expect(callArgs.where?.entryDate?.gte).toBeUndefined(); // no dateFrom
  });
});
