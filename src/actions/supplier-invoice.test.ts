import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted"),
  decrypt: vi.fn().mockReturnValue("decrypted"),
}));
vi.mock("@/lib/qonto", () => ({ createQontoTransfer: vi.fn().mockResolvedValue({ id: "qonto-1" }) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  uploadSupplierInvoice,
  getSupplierInvoicesPaginated,
  getSupplierInvoiceById,
  updateSupplierInvoiceData,
  validateSupplierInvoice,
  rejectSupplierInvoice,
  markSupplierInvoicePaid,
  initiateQontoPayment,
} from "./supplier-invoice";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const ACCOUNT_ID = "clh3x2z4k0002qh8g7z1y2v3v";
const BANK_ACCOUNT_ID = "clh3x2z4k0003qh8g7z1y2v3w";

function makeInvoice(overrides = {}) {
  return {
    id: INVOICE_ID,
    societyId: SOCIETY_ID,
    status: "PENDING_REVIEW",
    fileName: "facture.pdf",
    storagePath: "uploads/facture.pdf",
    fileUrl: "https://cdn.example.com/facture.pdf",
    fileSize: 12345,
    supplierName: "Fournisseur SAS",
    invoiceNumber: "INV-001",
    invoiceDate: new Date("2025-01-15"),
    amountHT: 1000,
    amountTTC: 1200,
    amountVAT: 200,
    buildingId: "clh3x2z4k0010qh8g7z1y2v3a",
    accountingAccountId: ACCOUNT_ID,
    categoryId: null,
    chargeId: null,
    reference: "FINV-123",
    ...overrides,
  };
}

const validUploadInput = {
  fileName: "facture.pdf",
  storagePath: "uploads/society/facture.pdf",
  fileUrl: "https://cdn.example.com/facture.pdf",
  fileSize: 12345,
};

const validPaidInput = {
  invoiceId: INVOICE_ID,
  paidAt: "2025-02-01",
  bankAccountId: BANK_ACCOUNT_ID,
  reference: "VIR-001",
};

describe("uploadSupplierInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await uploadSupplierInvoice(SOCIETY_ID, validUploadInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (nom fichier vide)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await uploadSupplierInvoice(SOCIETY_ID, { ...validUploadInput, fileName: "" });
    expect(result.success).toBe(false);
  });

  it("crée la facture fournisseur avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.create.mockResolvedValue(makeInvoice() as never);

    const result = await uploadSupplierInvoice(SOCIETY_ID, validUploadInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(INVOICE_ID);
    expect(prismaMock.supplierInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_REVIEW", source: "manual_upload" }),
      })
    );
  });

  it("retourne une erreur ForbiddenError (lignes 72-73)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await uploadSupplierInvoice(SOCIETY_ID, validUploadInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (ligne 74)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.create.mockRejectedValue(new Error("DB crash"));
    const result = await uploadSupplierInvoice(SOCIETY_ID, validUploadInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("upload");
  });
});

describe("getSupplierInvoicesPaginated", () => {
  it("retourne { data: [], total: 0 } si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getSupplierInvoicesPaginated(SOCIETY_ID);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("retourne les factures paginées", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findMany.mockResolvedValue([makeInvoice()] as never);
    prismaMock.supplierInvoice.count.mockResolvedValue(1 as never);

    const result = await getSupplierInvoicesPaginated(SOCIETY_ID, { page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("filtre par status (ligne 103)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findMany.mockResolvedValue([] as never);
    prismaMock.supplierInvoice.count.mockResolvedValue(0 as never);
    await getSupplierInvoicesPaginated(SOCIETY_ID, { status: "VALIDATED" });
    expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalled();
  });

  it("filtre par buildingId (ligne 104)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findMany.mockResolvedValue([] as never);
    prismaMock.supplierInvoice.count.mockResolvedValue(0 as never);
    await getSupplierInvoicesPaginated(SOCIETY_ID, { buildingId: "bld-1" });
    expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalled();
  });

  it("filtre par recherche texte (lignes 107-108)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findMany.mockResolvedValue([] as never);
    prismaMock.supplierInvoice.count.mockResolvedValue(0 as never);
    await getSupplierInvoicesPaginated(SOCIETY_ID, { search: "fournisseur" });
    expect(prismaMock.supplierInvoice.findMany).toHaveBeenCalled();
  });
});

describe("getSupplierInvoiceById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getSupplierInvoiceById(SOCIETY_ID, INVOICE_ID);
    expect(result).toBeNull();
  });

  it("retourne la facture si trouvée", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);

    const result = await getSupplierInvoiceById(SOCIETY_ID, INVOICE_ID);
    expect(result?.id).toBe(INVOICE_ID);
  });
});

describe("updateSupplierInvoiceData", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierName: "Test" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierName: "Test" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("met à jour les données avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeInvoice({ supplierName: "Nouveau fournisseur" }) as never);

    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierName: "Nouveau fournisseur" });
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalled();
  });

  it("chiffre l'IBAN si fourni", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeInvoice() as never);

    await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierIban: "FR7630006000011234567890189" });
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ supplierIbanEncrypted: "encrypted" }),
      })
    );
  });

  it("retourne une erreur Zod si id invalide (lignes 230-232)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: "not-a-cuid", supplierName: "Test" });
    expect(result.success).toBe(false);
  });

  it("met a jour les champs de date (lignes 254-263)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeInvoice() as never);
    const result = await updateSupplierInvoiceData(SOCIETY_ID, {
      id: INVOICE_ID,
      invoiceDate: "2026-01-15",
      dueDate: "2026-02-15",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoiceDate: expect.any(Date) }) })
    );
  });

  it("retourne une erreur ForbiddenError (lignes 284-285)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierName: "Test" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (ligne 286)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierName: "Test" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("jour");
  });
});

describe("validateSupplierInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si la facture n'est pas en PENDING_REVIEW", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "VALIDATED" }) as never);

    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/révision/);
  });

  it("retourne une erreur si aucun immeuble associé", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ buildingId: null }) as never);

    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/immeuble/);
  });

  it("retourne une erreur si montant TTC manquant", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ amountTTC: null }) as never);

    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/TTC/);
  });

  it("retourne une erreur si aucun compte comptable ni catégorie", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({ accountingAccountId: null, categoryId: null }) as never
    );

    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/compte comptable/);
  });

  it("valide une facture fournisseur et retourne chargeId et journalEntryId", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({
        status: "PENDING_REVIEW",
        buildingId: "building-1",
        accountingAccountId: ACCOUNT_ID,
        amountTTC: 1200,
        supplierName: "Fournisseur SA",
        invoiceDate: new Date("2026-04-01"),
      }) as never
    );
    prismaMock.$transaction.mockResolvedValue({ chargeId: null, journalEntryId: "journal-1" } as never);

    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ chargeId: null, journalEntryId: "journal-1" });
  });

  it("retourne une erreur Zod si invoiceId invalide (lignes 301-303)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await validateSupplierInvoice(SOCIETY_ID, "not-a-cuid");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si supplierName manquant (ligne 321)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({ supplierName: null, invoiceDate: new Date("2026-04-01") }) as never
    );
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("fournisseur");
  });

  it("retourne une erreur si invoiceDate manquante (ligne precedant 321)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({ supplierName: "Fournisseur SA", invoiceDate: null }) as never
    );
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("date");
  });

  it("valide avec categoryId et cree une charge via transaction (lignes 326-328, 346+)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({
        status: "PENDING_REVIEW",
        buildingId: "bld-1",
        categoryId: "cat-1",
        accountingAccountId: null,
        amountTTC: 1200,
        amountHT: 1000,
        amountVAT: 200,
        supplierName: "Fournisseur SA",
        invoiceDate: new Date("2026-04-01"),
        description: "Desc",
      }) as never
    );
    const mockAccount60 = { id: "acc-60" };
    const mockAccount401 = { id: "acc-401" };
    const mockAccount445 = { id: "acc-445" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        charge: { create: vi.fn().mockResolvedValue({ id: "charge-1" }) },
        accountingAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn()
            .mockResolvedValueOnce(mockAccount60)
            .mockResolvedValueOnce(mockAccount401)
            .mockResolvedValueOnce(mockAccount445),
        },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: "journal-1" }) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.chargeId).toBe("charge-1");
  });

  it("retourne une erreur ForbiddenError (lignes 444-445)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (ligne 446)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("validation");
  });
});

describe("rejectSupplierInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await rejectSupplierInvoice(SOCIETY_ID, INVOICE_ID, "Doublon");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si raison vide", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await rejectSupplierInvoice(SOCIETY_ID, INVOICE_ID, "");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await rejectSupplierInvoice(SOCIETY_ID, INVOICE_ID, "Facture invalide");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("rejette la facture avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeInvoice({ status: "REJECTED" }) as never);

    const result = await rejectSupplierInvoice(SOCIETY_ID, INVOICE_ID, "Doublon");
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", rejectionReason: "Doublon" }) })
    );
  });

  it("retourne une erreur ForbiddenError (lignes 496-497)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await rejectSupplierInvoice(SOCIETY_ID, INVOICE_ID, "Doublon");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue (ligne 498)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await rejectSupplierInvoice(SOCIETY_ID, INVOICE_ID, "Doublon");
    expect(result.success).toBe(false);
    expect(result.error).toContain("rejet");
  });
});

// ── initiateQontoPayment ───────────────────────────────────────────────────────

function makeQontoBankAccount(overrides = {}) {
  return {
    id: BANK_ACCOUNT_ID,
    societyId: SOCIETY_ID,
    qontoAccountId: "qonto-account-abc",
    connection: {
      id: "conn-1",
      provider: "QONTO",
      qontoSlugEncrypted: "encrypted-slug",
      qontoSecretKeyEncrypted: "encrypted-secret",
    },
    ...overrides,
  };
}

function makeValidatedInvoice(overrides = {}) {
  return {
    ...makeInvoice({ status: "VALIDATED" }),
    supplierIbanEncrypted: "encrypted-iban",
    supplierBic: "QNTOFRP1XXX",
    description: "Travaux plomberie",
    ...overrides,
  };
}

describe("initiateQontoPayment", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la facture est introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si la facture n'est pas validée", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "PENDING_REVIEW" }) as never);

    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid/);
  });

  it("retourne une erreur si l'IBAN du fournisseur est absent", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeValidatedInvoice({ supplierIbanEncrypted: null }) as never
    );

    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/IBAN/);
  });

  it("retourne une erreur si le compte bancaire est introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeValidatedInvoice() as never);
    prismaMock.bankAccount.findFirst.mockResolvedValue(null);

    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Compte bancaire introuvable/);
  });

  it("retourne une erreur si le compte n'est pas de type Qonto", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeValidatedInvoice() as never);
    prismaMock.bankAccount.findFirst.mockResolvedValue(
      makeQontoBankAccount({ connection: { id: "conn-1", provider: "GOCARDLESS", qontoSlugEncrypted: null, qontoSecretKeyEncrypted: null } }) as never
    );

    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Qonto/);
  });

  it("retourne une erreur si identifiants Qonto manquants (ligne 665)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeValidatedInvoice() as never);
    prismaMock.bankAccount.findFirst.mockResolvedValue(
      makeQontoBankAccount({ connection: { id: "conn-1", provider: "QONTO", qontoSlugEncrypted: null, qontoSecretKeyEncrypted: null } }) as never
    );
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("manquants");
  });

  it("retourne une erreur si qontoAccountId manquant (ligne 668)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeValidatedInvoice() as never);
    prismaMock.bankAccount.findFirst.mockResolvedValue(
      makeQontoBankAccount({ qontoAccountId: null }) as never
    );
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Identifiant de compte");
  });

  it("initie le virement Qonto avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeValidatedInvoice() as never);
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeQontoBankAccount() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeValidatedInvoice({ qontoTransferId: "qonto-1" }) as never);

    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(true);
    expect(result.data?.qontoTransferId).toBe("qonto-1");
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: "QONTO", paymentStatus: "SUBMITTED", qontoTransferId: "qonto-1" }),
      })
    );
  });
});

describe("markSupplierInvoicePaid", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si la facture n'est pas validée", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "PENDING_REVIEW" }) as never);

    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid/);
  });

  it("marque la facture comme payée avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({ status: "VALIDATED" }) as never);
    prismaMock.$transaction.mockResolvedValue({ bankJournalEntryId: null } as never);

    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ bankJournalEntryId: null });
  });

  it("retourne une erreur Zod si invoiceId invalide (lignes 513-515)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await markSupplierInvoicePaid(SOCIETY_ID, { ...validPaidInput, invoiceId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("execute la transaction avec comptes et cree l'ecriture BQUE (lignes 529-595)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({ status: "VALIDATED", amountTTC: 1200, chargeId: "charge-1" }) as never
    );
    const mockAccount401 = { id: "acc-401" };
    const mockAccount512 = { id: "acc-512" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        accountingAccount: {
          findFirst: vi.fn()
            .mockResolvedValueOnce(mockAccount401)
            .mockResolvedValueOnce(mockAccount512),
        },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: "bque-1" }) },
        charge: { update: vi.fn().mockResolvedValue({}) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(true);
    expect(result.data?.bankJournalEntryId).toBe("bque-1");
  });

  it("retourne une erreur ForbiddenError dans markSupplierInvoicePaid (lignes 615-616)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue dans markSupplierInvoicePaid (ligne 617)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("pay");
  });
  it("retourne une erreur si amountTTC est null dans initiateQontoPayment (ligne 642)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({
        status: "VALIDATED",
        supplierIbanEncrypted: "encrypted",
        amountTTC: null,
        supplierName: "Fournisseur SA",
      }) as never
    );
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("TTC");
  });

  it("retourne une erreur si supplierName est null dans initiateQontoPayment (ligne 645)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({
        status: "VALIDATED",
        supplierIbanEncrypted: "encrypted",
        amountTTC: 1200,
        supplierName: null,
      }) as never
    );
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("fournisseur");
  });

  it("retourne une erreur ForbiddenError dans initiateQontoPayment (lignes 721-722)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur generique si la BDD echoue dans initiateQontoPayment (ligne 723)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Qonto");
  });

});

// ── Branches restantes ────────────────────────────────────────────────────────

describe("uploadSupplierInvoice — branches restantes", () => {
  it("fileSize vaut null quand absent du payload (B1 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.create.mockResolvedValue(makeInvoice({ fileSize: null }) as never);
    const { fileSize: _, ...noFileSize } = validUploadInput;
    const result = await uploadSupplierInvoice(SOCIETY_ID, noFileSize);
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fileSize: null }) })
    );
  });
});

describe("updateSupplierInvoiceData — branches restantes", () => {
  it("supprime l'IBAN si supplierIban est null (B16 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeInvoice() as never);
    const result = await updateSupplierInvoiceData(SOCIETY_ID, { id: INVOICE_ID, supplierIban: null });
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ supplierIbanEncrypted: null }) })
    );
  });

  it("stocke null pour les dates nulles (B18/B20/B22/B24 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeInvoice() as never);
    const result = await updateSupplierInvoiceData(SOCIETY_ID, {
      id: INVOICE_ID,
      invoiceDate: null,
      dueDate: null,
      periodStart: null,
      periodEnd: null,
    });
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoiceDate: null, dueDate: null, periodStart: null, periodEnd: null }),
      })
    );
  });
});

describe("validateSupplierInvoice — branches transaction restantes", () => {
  it("valide sans charge (categoryId null) avec findUnique compteCharge (B36 arm1, B40 arm0, B43/B44/B45/B48/B49/B50 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({
      status: "PENDING_REVIEW",
      buildingId: "bld-1",
      categoryId: null,
      accountingAccountId: ACCOUNT_ID,
      amountTTC: 1200,
      amountHT: null,
      amountVAT: null,
      description: null,
      invoiceNumber: null,
    }) as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        accountingAccount: {
          findUnique: vi.fn().mockResolvedValue({ id: "acc-60" }),
          findFirst: vi.fn().mockResolvedValue({ id: "acc-401" }),
        },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: "jnl-1" }) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.chargeId).toBeNull();
  });

  it("valide avec categoryId et invoiceNumber null dans description charge (B37 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({
      status: "PENDING_REVIEW",
      buildingId: "bld-1",
      categoryId: "cat-1",
      accountingAccountId: null,
      amountTTC: 1200,
      amountHT: 1000,
      amountVAT: null,
      description: "desc",
      invoiceNumber: null,
    }) as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        charge: { create: vi.fn().mockResolvedValue({ id: "chg-1" }) },
        accountingAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "acc-60" })
            .mockResolvedValueOnce({ id: "acc-401" }),
        },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: "jnl-1" }) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.chargeId).toBe("chg-1");
  });

  it("ne crée pas d'écriture si comptes comptables introuvables (B41 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({
      status: "PENDING_REVIEW",
      buildingId: "bld-1",
      categoryId: null,
      accountingAccountId: ACCOUNT_ID,
      amountTTC: 1200,
    }) as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        accountingAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.journalEntryId).toBeNull();
  });

  it("saute la ligne TVA si compte 44566 introuvable (B47 arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeInvoice({
      status: "PENDING_REVIEW",
      buildingId: "bld-1",
      categoryId: "cat-1",
      accountingAccountId: null,
      amountTTC: 1200,
      amountHT: 1000,
      amountVAT: 200,
      supplierName: "Fournisseur SA",
      invoiceDate: new Date("2026-04-01"),
    }) as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        charge: { create: vi.fn().mockResolvedValue({ id: "chg-vat" }) },
        accountingAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "acc-60" })
            .mockResolvedValueOnce({ id: "acc-401" })
            .mockResolvedValueOnce(null), // compte44566 absent → B47 arm1
        },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: "jnl-vat" }) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await validateSupplierInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.chargeId).toBe("chg-vat");
  });
});

describe("markSupplierInvoicePaid — branches transaction restantes", () => {
  it("ne crée pas d'écriture BQUE si comptes 401/512 introuvables (B60 arm1)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({ status: "VALIDATED", amountTTC: 1200, chargeId: null }) as never
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        accountingAccount: { findFirst: vi.fn().mockResolvedValue(null) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const result = await markSupplierInvoicePaid(SOCIETY_ID, validPaidInput);
    expect(result.success).toBe(true);
    expect(result.data?.bankJournalEntryId).toBeNull();
  });

  it("gère reference null et supplierName null dans l'écriture BQUE (B62/B63/B64/B65/B66/B67 arm1)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeInvoice({ status: "VALIDATED", amountTTC: 1200, chargeId: null, supplierName: null, reference: "REF-X" }) as never
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        accountingAccount: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: "acc-401" })
            .mockResolvedValueOnce({ id: "acc-512" }),
        },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: "bque-x" }) },
        supplierInvoice: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const { reference: _, ...noRef } = validPaidInput;
    const result = await markSupplierInvoicePaid(SOCIETY_ID, noRef);
    expect(result.success).toBe(true);
    expect(result.data?.bankJournalEntryId).toBe("bque-x");
  });
});

describe("initiateQontoPayment — branches restantes", () => {
  it("retourne une erreur si le compte bancaire n'a pas de connexion (B76 arm0)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(makeValidatedInvoice() as never);
    prismaMock.bankAccount.findFirst.mockResolvedValue(
      makeQontoBankAccount({ connection: null }) as never
    );
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("connexion");
  });

  it("initie le virement sans BIC/description/invoiceNumber (B81/B82/B83 arm1)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(
      makeValidatedInvoice({ supplierBic: null, description: null, invoiceNumber: null }) as never
    );
    prismaMock.bankAccount.findFirst.mockResolvedValue(makeQontoBankAccount() as never);
    prismaMock.supplierInvoice.update.mockResolvedValue(makeValidatedInvoice() as never);
    const result = await initiateQontoPayment(SOCIETY_ID, INVOICE_ID, BANK_ACCOUNT_ID);
    expect(result.success).toBe(true);
    expect(result.data?.qontoTransferId).toBe("qonto-1");
  });
});
