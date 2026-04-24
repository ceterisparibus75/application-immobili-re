import { describe, it, expect, vi } from "vitest";

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
});
