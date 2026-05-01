import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  getFiscalYears,
  createFiscalYear,
  closeFiscalYear,
  generateOpeningEntries,
  getAccounts,
  getBalance,
  getGrandLivre,
  createJournalEntry,
  validateJournalEntry,
  bulkImportAccounts,
  bulkImportJournalEntries,
} from "./accounting";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const FISCAL_YEAR_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const ACCOUNT_ID_1 = "clh3x2z4k0002qh8g7z1y2v3v";
const ACCOUNT_ID_2 = "clh3x2z4k0003qh8g7z1y2v3w";
const ENTRY_ID = "clh3x2z4k0004qh8g7z1y2v3x";

function makeFiscalYear(overrides = {}) {
  return {
    id: FISCAL_YEAR_ID,
    societyId: SOCIETY_ID,
    year: 2025,
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
    isClosed: false,
    closedAt: null,
    closedBy: null,
    ...overrides,
  };
}

const validJournalInput = {
  journalType: "VT",
  entryDate: "2025-01-15",
  label: "Facture loyer",
  lines: [
    { accountId: ACCOUNT_ID_1, debit: 1000, credit: 0 },
    { accountId: ACCOUNT_ID_2, debit: 0, credit: 1000 },
  ],
};

describe("getFiscalYears", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getFiscalYears(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne la liste des exercices fiscaux", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findMany.mockResolvedValue([makeFiscalYear()] as never);

    const result = await getFiscalYears(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBe(1);
  });

  it("retourne une erreur générique si la BDD échoue dans getFiscalYears", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await getFiscalYears(SOCIETY_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la récupération des exercices" });
  });
});

describe("createFiscalYear", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createFiscalYear(SOCIETY_ID, { year: 2025, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (année hors plage)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await createFiscalYear(SOCIETY_ID, { year: 1999, startDate: "1999-01-01", endDate: "1999-12-31" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si l'exercice existe déjà", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findUnique.mockResolvedValue(makeFiscalYear() as never);

    const result = await createFiscalYear(SOCIETY_ID, { year: 2025, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/existe déjà/);
  });

  it("crée l'exercice avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findUnique.mockResolvedValue(null);
    prismaMock.fiscalYear.create.mockResolvedValue(makeFiscalYear() as never);

    const result = await createFiscalYear(SOCIETY_ID, { year: 2025, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(FISCAL_YEAR_ID);
  });

  it("retourne une erreur si rôle insuffisant pour createFiscalYear", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await createFiscalYear(SOCIETY_ID, { year: 2025, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createFiscalYear", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findUnique.mockRejectedValue(new Error("DB connection lost"));
    const result = await createFiscalYear(SOCIETY_ID, { year: 2025, startDate: "2025-01-01", endDate: "2025-12-31" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la création de l'exercice" });
  });
});

describe("closeFiscalYear", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si exercice introuvable", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si exercice déjà clôturé", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear({ isClosed: true }) as never);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clôturé/);
  });

  it("retourne une erreur si des écritures en brouillon existent", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear() as never);
    prismaMock.journalEntry.count.mockResolvedValue(3 as never);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/brouillon/);
  });

  it("retourne une erreur si la balance n'est pas équilibrée", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear() as never);
    prismaMock.journalEntry.count.mockResolvedValue(0 as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 500 },
    ] as never);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/équilibr/);
  });

  it("retourne une erreur si des comptes mouvementés ne sont pas revus", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear() as never);
    prismaMock.journalEntry.count.mockResolvedValue(0 as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 1000, accountId: ACCOUNT_ID_1 },
    ] as never);
    prismaMock.accountReview.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/réviser/);
  });

  it("retourne une erreur si un compte a un point de révision ouvert", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear() as never);
    prismaMock.journalEntry.count.mockResolvedValue(0 as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 1000, accountId: ACCOUNT_ID_1 },
    ] as never);
    prismaMock.accountReview.count
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(1 as never);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/point de révision/);
  });

  it("clôture l'exercice avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear() as never);
    prismaMock.journalEntry.count.mockResolvedValue(0 as never);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 1000, accountId: ACCOUNT_ID_1 },
    ] as never);
    prismaMock.accountReview.count
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.fiscalYear.update.mockResolvedValue({} as never);
    prismaMock.journalEntry.updateMany.mockResolvedValue({ count: 5 } as never);

    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.fiscalYear.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isClosed: true }) })
    );
  });

  it("retourne une erreur si rôle insuffisant pour closeFiscalYear", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans closeFiscalYear", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await closeFiscalYear(SOCIETY_ID, FISCAL_YEAR_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la clôture" });
  });
});

describe("generateOpeningEntries", () => {
  it("retourne une erreur si l'exercice source n'est pas clôturé", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear({ isClosed: false }) as never);

    const result = await generateOpeningEntries(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/après clôture/);
  });

  it("génère une écriture d'à-nouveaux équilibrée", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear({ isClosed: true, year: 2025 }) as never);
    prismaMock.fiscalYear.findUnique.mockResolvedValue({
      id: "fy-2026",
      year: 2026,
      startDate: new Date("2026-01-01"),
    } as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 0, accountId: "bank", account: { code: "512000", label: "Banque", type: "5" } },
      { debit: 0, credit: 1000, accountId: "capital", account: { code: "101000", label: "Capital", type: "1" } },
      { debit: 300, credit: 0, accountId: "charge", account: { code: "615100", label: "Entretien", type: "6" } },
      { debit: 0, credit: 300, accountId: "product", account: { code: "706100", label: "Loyers", type: "7" } },
    ] as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: "an-entry" } as never);

    const result = await generateOpeningEntries(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result).toEqual({ success: true, data: { id: "an-entry", alreadyExists: false } });
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "AN",
          fiscalYearId: "fy-2026",
          reference: `opening:${FISCAL_YEAR_ID}:fy-2026`,
        }),
      })
    );
  });

  it("retourne l'écriture existante si les à-nouveaux existent déjà", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear({ isClosed: true, year: 2025 }) as never);
    prismaMock.fiscalYear.findUnique.mockResolvedValue({
      id: "fy-2026",
      year: 2026,
      startDate: new Date("2026-01-01"),
    } as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue({ id: "existing-an" } as never);

    const result = await generateOpeningEntries(SOCIETY_ID, FISCAL_YEAR_ID);

    expect(result).toEqual({ success: true, data: { id: "existing-an", alreadyExists: true } });
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });
});

describe("getAccounts", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getAccounts(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne la liste des comptes actifs", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000", label: "Clients", type: "4" },
    ] as never);

    const result = await getAccounts(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBe(1);
  });

  it("retourne une erreur générique si la BDD échoue dans getAccounts", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await getAccounts(SOCIETY_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la récupération des comptes" });
  });
});

describe("getBalance", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getBalance(SOCIETY_ID, {});
    expect(result.success).toBe(false);
  });

  it("agrège les lignes par compte et calcule les soldes", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      { debit: 1000, credit: 0, account: { id: ACCOUNT_ID_1, code: "411000", label: "Clients", type: "4" } },
      { debit: 500, credit: 0, account: { id: ACCOUNT_ID_1, code: "411000", label: "Clients", type: "4" } },
      { debit: 0, credit: 1500, account: { id: ACCOUNT_ID_2, code: "706000", label: "Produits", type: "7" } },
    ] as never);

    const result = await getBalance(SOCIETY_ID, {});
    expect(result.success).toBe(true);
    const data = result.data as Array<{ totalDebit: number; totalCredit: number; soldeDebiteur: number; soldeCrediteur: number }>;
    const compte411 = data.find((r: { totalDebit: number }) => r.totalDebit > 0);
    expect(compte411?.totalDebit).toBe(1500);
    expect(compte411?.soldeDebiteur).toBe(1500);
    expect(compte411?.soldeCrediteur).toBe(0);
  });

  it("retourne un tableau vide si aucune ligne", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([] as never);

    const result = await getBalance(SOCIETY_ID, {});
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it("retourne une erreur générique si la BDD échoue dans getBalance", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await getBalance(SOCIETY_ID, {});
    expect(result).toEqual({ success: false, error: "Erreur lors du calcul de la balance" });
  });

  it("filtre getBalance par dateTo seul sans dateFrom — branche interne false (ligne 228)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([] as never);

    const result = await getBalance(SOCIETY_ID, { dateTo: "2025-12-31" });

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({
            entryDate: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      })
    );
  });

  it("filtre getBalance par classe, fiscalYearId, dateFrom et dateTo (lignes 222-228)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([] as never);

    const result = await getBalance(SOCIETY_ID, {
      classe: "4",
      fiscalYearId: FISCAL_YEAR_ID,
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
    });

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          account: expect.objectContaining({ type: "4" }),
          journalEntry: expect.objectContaining({
            fiscalYearId: FISCAL_YEAR_ID,
            entryDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      })
    );
  });
});

describe("getGrandLivre", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getGrandLivre(SOCIETY_ID, {});
    expect(result.success).toBe(false);
  });

  it("calcule le solde cumulé des lignes", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: "l1",
        debit: 1000,
        credit: 0,
        label: "Loyer",
        lettrage: null,
        account: { code: "411000", label: "Clients" },
        journalEntry: { entryDate: new Date("2025-01-15"), piece: "FAC-001", journalType: "VT", label: "Facture", status: "VALIDE" },
      },
      {
        id: "l2",
        debit: 0,
        credit: 400,
        label: "Avoir",
        lettrage: null,
        account: { code: "411000", label: "Clients" },
        journalEntry: { entryDate: new Date("2025-01-20"), piece: "AVO-001", journalType: "VT", label: "Avoir", status: "VALIDE" },
      },
    ] as never);

    const result = await getGrandLivre(SOCIETY_ID, {});
    expect(result.success).toBe(true);
    const rows = result.data as Array<{ solde: number }>;
    expect(rows[0].solde).toBe(1000);
    expect(rows[1].solde).toBe(600);
  });

  it("filtre par dateTo seul (sans dateFrom)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([]);
    const result = await getGrandLivre(SOCIETY_ID, { dateTo: "2025-12-31" });
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({
            entryDate: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      })
    );
  });

  it("filtre par dateTo et dateFrom combinés", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([]);
    const result = await getGrandLivre(SOCIETY_ID, { dateTo: "2025-12-31", dateFrom: "2025-01-01" });
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({
            entryDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      })
    );
  });

  it("retourne une erreur générique si la BDD échoue dans getGrandLivre", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await getGrandLivre(SOCIETY_ID, {});
    expect(result).toEqual({ success: false, error: "Erreur lors de la récupération du grand livre" });
  });
});

describe("createJournalEntry", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (moins de 2 lignes)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await createJournalEntry(SOCIETY_ID, {
      ...validJournalInput,
      lines: [{ accountId: ACCOUNT_ID_1, debit: 1000, credit: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si débit ≠ crédit", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await createJournalEntry(SOCIETY_ID, {
      ...validJournalInput,
      lines: [
        { accountId: ACCOUNT_ID_1, debit: 1000, credit: 0 },
        { accountId: ACCOUNT_ID_2, debit: 0, credit: 500 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/équilibr/);
  });

  it("retourne une erreur si un compte est invalide", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1 },
      // ACCOUNT_ID_2 manquant → compte invalide
    ] as never);

    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/);
  });

  it("crée l'écriture avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1 },
      { id: ACCOUNT_ID_2 },
    ] as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);

    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(ENTRY_ID);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BROUILLON" }) })
    );
  });

  it("retourne une erreur si rôle insuffisant pour createJournalEntry", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createJournalEntry", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la création de l'écriture" });
  });
});

describe("bulkImportAccounts", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await bulkImportAccounts(SOCIETY_ID, []);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si liste vide", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await bulkImportAccounts(SOCIETY_ID, []);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Aucun/);
  });

  it("importe les comptes et saute les doublons", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findUnique
      .mockResolvedValueOnce(null) // compte 1 nouveau
      .mockResolvedValueOnce({ id: "existing" } as never); // compte 2 existe déjà
    prismaMock.accountingAccount.create.mockResolvedValue({} as never);

    const result = await bulkImportAccounts(SOCIETY_ID, [
      { code: "411000", label: "Clients", type: "4" },
      { code: "706000", label: "Produits", type: "7" },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.imported).toBe(1);
    expect(result.data?.skipped).toBe(1);
  });

  it("retourne une erreur si plus de 500 comptes", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const accounts = Array.from({ length: 501 }, (_, i) => ({ code: `${i}`, label: "Test", type: "4" }));
    const result = await bulkImportAccounts(SOCIETY_ID, accounts);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/500/);
  });

  it("retourne une erreur si rôle insuffisant pour bulkImportAccounts", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await bulkImportAccounts(SOCIETY_ID, [{ code: "411000", label: "Clients", type: "4" }]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans bulkImportAccounts", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findUnique.mockRejectedValue(new Error("DB connection lost"));
    const result = await bulkImportAccounts(SOCIETY_ID, [{ code: "411000", label: "Clients", type: "4" }]);
    expect(result).toEqual({ success: false, error: "Erreur lors de l'import" });
  });
});

describe("bulkImportJournalEntries", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await bulkImportJournalEntries(SOCIETY_ID, []);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si liste vide", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await bulkImportJournalEntries(SOCIETY_ID, []);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Aucune/);
  });

  it("retourne une erreur si plus de 2000 écritures (ligne 507)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const entries = Array.from({ length: 2001 }, () => ({
      journalType: "VT" as const,
      entryDate: "2025-01-15",
      label: "Test",
      lines: [{ accountCode: "411000", debit: 1000, credit: 0 }],
    }));
    const result = await bulkImportJournalEntries(SOCIETY_ID, entries);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/2000/);
  });

  it("importe les écritures avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
      { id: ACCOUNT_ID_2, code: "706000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture loyer",
        lines: [
          { accountCode: "411000", debit: 1000, credit: 0 },
          { accountCode: "706000", debit: 0, credit: 1000 },
        ],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.imported).toBe(1);
    expect(result.data?.skipped).toBe(0);
  });

  it("saute une écriture si le compte est introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([] as never); // aucun compte
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture",
        lines: [{ accountCode: "411000", debit: 1000, credit: 0 }],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.errors.length).toBeGreaterThan(0);
  });

  it("catch interne avec piece null et throw non-Error — branches ?? et instanceof (ligne 566)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockRejectedValue("string error");

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture sans pièce",
        lines: [{ accountCode: "411000", debit: 1000, credit: 0 }],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.errors[0]).toContain("Erreur");
  });

  it("saute une écriture si la création en BDD échoue (catch interne)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
      { id: ACCOUNT_ID_2, code: "706000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockRejectedValue(new Error("Insert failed"));

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        piece: "FAC-001",
        label: "Facture loyer",
        lines: [
          { accountCode: "411000", debit: 1000, credit: 0 },
          { accountCode: "706000", debit: 0, credit: 1000 },
        ],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.errors.length).toBeGreaterThan(0);
  });

  it("retourne une erreur si rôle insuffisant pour bulkImportJournalEntries", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture loyer",
        lines: [{ accountCode: "411000", debit: 1000, credit: 0 }],
      },
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans bulkImportJournalEntries", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture loyer",
        lines: [{ accountCode: "411000", debit: 1000, credit: 0 }],
      },
    ]);
    expect(result).toEqual({ success: false, error: "Erreur lors de l'import" });
  });

  it("saute une écriture déjà existante en BDD (doublon)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
      { id: ACCOUNT_ID_2, code: "706000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue({ id: ENTRY_ID } as never);

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture loyer",
        lines: [
          { accountCode: "411000", debit: 1000, credit: 0 },
          { accountCode: "706000", debit: 0, credit: 1000 },
        ],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.imported).toBe(0);
    expect(result.data?.skipped).toBe(1);
  });

  it("normalise un type de journal inconnu en OD", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
      { id: ACCOUNT_ID_2, code: "706000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "MISC",
        entryDate: "2025-01-15",
        label: "Écriture diverse",
        lines: [
          { accountCode: "411000", debit: 500, credit: 0 },
          { accountCode: "706000", debit: 0, credit: 500 },
        ],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.imported).toBe(1);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ journalType: "OD" }) })
    );
  });
});


// ─── ForbiddenError branches ──────────────────────────────────────────────────

describe("getFiscalYears — ForbiddenError", () => {
  it("retourne une erreur si pas de membership (ligne 79)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await getFiscalYears(SOCIETY_ID);
    expect(result.success).toBe(false);
  });
});

describe("getAccounts — ForbiddenError", () => {
  it("retourne une erreur si pas de membership (ligne 203)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await getAccounts(SOCIETY_ID);
    expect(result.success).toBe(false);
  });
});

describe("getBalance — ForbiddenError", () => {
  it("retourne une erreur si pas de membership (ligne 272)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await getBalance(SOCIETY_ID, {});
    expect(result.success).toBe(false);
  });
});

describe("getGrandLivre — ForbiddenError", () => {
  it("retourne une erreur si pas de membership (ligne 332)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await getGrandLivre(SOCIETY_ID, {});
    expect(result.success).toBe(false);
  });
});

describe("getGrandLivre — filtres accountId, fiscalYearId, journalType (lignes 289-293)", () => {
  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([]);
  });

  it("filtre par accountId", async () => {
    const result = await getGrandLivre(SOCIETY_ID, { accountId: ACCOUNT_ID_1 });
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: ACCOUNT_ID_1 }),
      })
    );
  });

  it("filtre par fiscalYearId", async () => {
    const result = await getGrandLivre(SOCIETY_ID, { fiscalYearId: FISCAL_YEAR_ID });
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({ fiscalYearId: FISCAL_YEAR_ID }),
        }),
      })
    );
  });

  it("filtre par journalType", async () => {
    const result = await getGrandLivre(SOCIETY_ID, { journalType: "VT" });
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntryLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({ journalType: "VT" }),
        }),
      })
    );
  });
});

describe("bulkImportAccounts — code ou label vide", () => {
  it("saute les comptes dont le code ou le label est vide apres trim (ligne 432)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findUnique.mockResolvedValue(null as never);
    prismaMock.accountingAccount.create.mockResolvedValue({} as never);

    const result = await bulkImportAccounts(SOCIETY_ID, [
      { code: "", label: "Clients", type: "4" },
      { code: "411000", label: "", type: "4" },
      { code: "706000", label: "Produits", type: "7" },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(2);
    expect(result.data?.imported).toBe(1);
  });
});

describe("bulkImportJournalEntries — normalizeJournalType branches", () => {
  const makeEntry = (journalType: string) => ({
    journalType,
    entryDate: "2025-01-15",
    label: "Test",
    lines: [
      { accountCode: "411000", debit: 100, credit: 0 },
      { accountCode: "706000", debit: 0, credit: 100 },
    ],
  });

  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
      { id: ACCOUNT_ID_2, code: "706000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);
  });

  it("normalise AN (ligne 491)", async () => {
    const r = await bulkImportJournalEntries(SOCIETY_ID, [makeEntry("AN")]);
    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ journalType: "AN" }) })
    );
  });

  it("normalise ACH -> AC (ligne 492)", async () => {
    const r = await bulkImportJournalEntries(SOCIETY_ID, [makeEntry("ACH")]);
    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ journalType: "AC" }) })
    );
  });

  it("normalise BQ -> BQUE (ligne 493)", async () => {
    const r = await bulkImportJournalEntries(SOCIETY_ID, [makeEntry("BQ")]);
    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ journalType: "BQUE" }) })
    );
  });

  it("normalise INV (ligne 494)", async () => {
    const r = await bulkImportJournalEntries(SOCIETY_ID, [makeEntry("INV")]);
    expect(r.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ journalType: "INV" }) })
    );
  });
});

describe("getGrandLivre — line.label null (ligne 318)", () => {
  it("utilise journalEntry.label si line.label est null", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntryLine.findMany.mockResolvedValue([
      {
        id: "l1",
        debit: 500,
        credit: 0,
        label: null,
        lettrage: null,
        account: { code: "411000", label: "Clients" },
        journalEntry: { entryDate: new Date("2025-01-15"), piece: "FAC-001", journalType: "VT", label: "Libellé journal", status: "VALIDE" },
      },
    ] as never);

    const result = await getGrandLivre(SOCIETY_ID, {});
    expect(result.success).toBe(true);
    const rows = result.data as Array<{ label: string }>;
    expect(rows[0].label).toBe("Libellé journal");
  });
});

describe("bulkImportJournalEntries — erreur non-Error dans catch (ligne 566)", () => {
  it("affiche 'Erreur' si l'exception n'est pas une instance de Error", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
      { id: ACCOUNT_ID_2, code: "706000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockRejectedValue("string-error");

    const result = await bulkImportJournalEntries(SOCIETY_ID, [
      {
        journalType: "VT",
        entryDate: "2025-01-15",
        label: "Facture loyer",
        lines: [
          { accountCode: "411000", debit: 1000, credit: 0 },
          { accountCode: "706000", debit: 0, credit: 1000 },
        ],
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.errors[0]).toContain("Erreur");
  });

  it("ne dépasse pas 20 erreurs dans le tableau (lignes 539, 566)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    const entries = Array.from({ length: 25 }, (_, i) => ({
      journalType: "VT",
      entryDate: "2025-01-15",
      label: `Facture ${i}`,
      lines: [{ accountCode: `999${i.toString().padStart(3, "0")}`, debit: 100, credit: 0 }],
    }));

    const result = await bulkImportJournalEntries(SOCIETY_ID, entries);
    expect(result.success).toBe(true);
    expect(result.data?.errors.length).toBeLessThanOrEqual(20);
  });

  it("ne dépasse pas 20 erreurs via journalEntry.create → B64 arm1 L566", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1, code: "411000" },
    ] as never);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockRejectedValue(new Error("DB create error"));

    // 21 entries with valid account codes → all reach journalEntry.create → all throw
    // First 20 throws: errors.length < 20 → push (arm0 x20)
    // 21st throw: errors.length = 20 >= 20 → skip push (arm1 x1)
    const entries = Array.from({ length: 21 }, (_, i) => ({
      journalType: "VT" as const,
      entryDate: "2025-01-15",
      label: `Facture ${i}`,
      lines: [{ accountCode: "411000", debit: 100, credit: 0 }],
    }));

    const result = await bulkImportJournalEntries(SOCIETY_ID, entries);
    expect(result.success).toBe(true);
    expect(result.data?.errors.length).toBe(20);
    expect(result.data?.skipped).toBe(21);
  });
});

// ─── Tests F-019 : validateJournalEntry + guard exercice clôturé ──────────────

describe("validateJournalEntry", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await validateJournalEntry(SOCIETY_ID, ENTRY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si l'écriture est introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntry.findFirst.mockResolvedValue(null);

    const result = await validateJournalEntry(SOCIETY_ID, ENTRY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si l'écriture est déjà validée", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: ENTRY_ID,
      status: "VALIDEE",
    } as never);

    const result = await validateJournalEntry(SOCIETY_ID, ENTRY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/validée/);
  });

  it("retourne une erreur si l'écriture est clôturée", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: ENTRY_ID,
      status: "CLOTUREE",
    } as never);

    const result = await validateJournalEntry(SOCIETY_ID, ENTRY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clôturée/);
  });

  it("valide une écriture en brouillon et la passe à VALIDEE", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.journalEntry.findFirst.mockResolvedValue({
      id: ENTRY_ID,
      status: "BROUILLON",
    } as never);
    prismaMock.journalEntry.update.mockResolvedValue({} as never);

    const result = await validateJournalEntry(SOCIETY_ID, ENTRY_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "VALIDEE", isValidated: true }),
      })
    );
  });

  it("retourne une erreur si rôle insuffisant", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await validateJournalEntry(SOCIETY_ID, ENTRY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });
});

describe("createJournalEntry — guard exercice clôturé", () => {
  it("rejette si l'exercice fiscal est clôturé", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      isClosed: true,
    } as never);

    const result = await createJournalEntry(SOCIETY_ID, {
      ...validJournalInput,
      fiscalYearId: FISCAL_YEAR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clôturé/);
  });

  it("rejette si l'exercice fiscal est introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);

    const result = await createJournalEntry(SOCIETY_ID, {
      ...validJournalInput,
      fiscalYearId: FISCAL_YEAR_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Exercice fiscal introuvable/);
  });

  it("rejette si la date tombe dans un exercice clôturé même sans fiscalYearId explicite", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      isClosed: true,
    } as never);

    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clôturé/);
  });

  it("autorise la création si l'exercice est ouvert", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      isClosed: false,
    } as never);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1 },
      { id: ACCOUNT_ID_2 },
    ] as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);

    const result = await createJournalEntry(SOCIETY_ID, {
      ...validJournalInput,
      fiscalYearId: FISCAL_YEAR_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rattache automatiquement l'écriture à l'exercice ouvert couvrant la date", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fiscalYear.findFirst.mockResolvedValue({
      id: FISCAL_YEAR_ID,
      isClosed: false,
    } as never);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_ID_1 },
      { id: ACCOUNT_ID_2 },
    ] as never);
    prismaMock.journalEntry.create.mockResolvedValue({ id: ENTRY_ID } as never);

    const result = await createJournalEntry(SOCIETY_ID, validJournalInput);

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fiscalYearId: FISCAL_YEAR_ID }),
      })
    );
  });
});

