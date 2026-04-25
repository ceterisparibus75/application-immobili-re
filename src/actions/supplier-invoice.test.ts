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
});
