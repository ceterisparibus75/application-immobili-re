import { describe, it, expect, vi } from "vitest";

const sendReceiptEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const renderToBufferMock = vi.hoisted(() => vi.fn().mockResolvedValue(Buffer.from("pdf-buffer")));
const getAllEmailCopyBccMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const supabaseStorageMock = vi.hoisted(() => ({
  upload: vi.fn().mockResolvedValue({ error: null }),
  download: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue({ success: true }),
  sendReceiptEmail: sendReceiptEmailMock,
}));
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: renderToBufferMock }));
vi.mock("@/lib/invoice-pdf", () => ({ InvoicePdf: () => null }));
vi.mock("@/lib/email-copy", () => ({ getAllEmailCopyBcc: getAllEmailCopyBccMock }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn(() => supabaseStorageMock) } })),
}));

import { sendInvoiceEmail } from "@/lib/email";
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-value"),
  encrypt: vi.fn().mockReturnValue("encrypted-value"),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  recordPayment,
  sendInvoiceToTenant,
  validateInvoice,
  validateBatchInvoices,
  cancelInvoice,
  markAsLitigious,
  markAsIrrecoverable,
  generateAndSendQuittance,
} from "./invoice-lifecycle";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0001qh8g7z1y2v3t";

function makeFullQuittance(id: string) {
  return {
    id,
    invoiceNumber: "QIT-2025-001",
    invoiceType: "QUITTANCE",
    issueDate: new Date("2025-01-31"),
    dueDate: new Date("2025-01-31"),
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-31"),
    totalHT: 800,
    totalVAT: 0,
    totalTTC: 800,
    tenantId: "tenant-1",
    leaseId: "lease-1",
    society: {
      name: "SCI Test", addressLine1: "1 rue de Paris", postalCode: "75001", city: "Paris",
      country: "France", phone: null, siret: null, vatNumber: null, legalForm: null,
      shareCapital: null, bankName: null, vatRegime: null, legalMentions: null,
      signatoryName: null, email: null, ibanEncrypted: null, bicEncrypted: null, logoUrl: null,
    },
    tenant: {
      entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Dupont",
      companyName: null, billingEmail: null, email: "jean@example.com",
      personalAddress: "2 rue de Lyon, 75002 Paris", companyAddress: null,
    },
    lease: { lot: { number: "A1", building: { name: "Immeuble A", addressLine1: "1 rue de Paris" } } },
    lines: [{ label: "Loyer", totalHT: 800, vatRate: 0, totalTTC: 800 }],
    payments: [{ paidAt: new Date("2025-01-10"), method: "virement", amount: 800 }],
  };
}

function makeInvoice(overrides = {}) {
  return {
    id: INVOICE_ID,
    societyId: SOCIETY_ID,
    invoiceNumber: "FAC-2025-001",
    invoiceType: "APPEL_LOYER",
    status: "VALIDEE",
    totalHT: 800,
    totalVAT: 0,
    totalTTC: 800,
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-31"),
    issueDate: new Date("2025-01-01"),
    dueDate: new Date("2025-01-05"),
    tenantId: "tenant-1",
    leaseId: "lease-1",
    payments: [],
    lines: [],
    creditNotes: [],
    tenant: {
      email: "jean@example.com",
      billingEmail: null,
      firstName: "Jean",
      lastName: "Dupont",
      entityType: "PERSONNE_PHYSIQUE",
      companyName: null,
    },
    society: { name: "SCI Test" },
    ...overrides,
  };
}

const validPaymentInput = {
  invoiceId: INVOICE_ID,
  amount: 800,
  paidAt: "2025-01-10",
};

// ── recordPayment ──────────────────────────────────────────────

describe("recordPayment", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await recordPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (invoiceId invalide)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    const result = await recordPayment(SOCIETY_ID, { ...validPaymentInput, invoiceId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await recordPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si la facture est en brouillon", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "BROUILLON", payments: [] }) as never);

    const result = await recordPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/brouillon/);
  });

  it("enregistre un paiement partiel et passe en PARTIELLEMENT_PAYE", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ totalTTC: 800, payments: [] }) as never);
    prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await recordPayment(SOCIETY_ID, { ...validPaymentInput, amount: 400 });
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PARTIELLEMENT_PAYE" } })
    );
  });

  it("enregistre un paiement complet et passe en PAYE", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ totalTTC: 800, payments: [] }) as never);
    prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await recordPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAYE" } })
    );
    expect(result.data?.id).toBe("payment-1");
  });

  it("prend en compte les paiements existants pour le calcul du total", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ totalTTC: 800, payments: [{ amount: 600 }] }) as never
    );
    prismaMock.payment.create.mockResolvedValue({ id: "payment-2" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    // Paiement de 200 → total = 800, donc PAYE
    const result = await recordPayment(SOCIETY_ID, { ...validPaymentInput, amount: 200 });
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAYE" } })
    );
  });

  it("retourne une erreur si rôle insuffisant pour recordPayment (ligne 95)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await recordPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans recordPayment (lignes 96-97)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await recordPayment(SOCIETY_ID, validPaymentInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de l'enregistrement du paiement" });
  });
});

// ── sendInvoiceToTenant ────────────────────────────────────────

describe("sendInvoiceToTenant", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si le locataire n'a pas d'email", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ tenant: { email: null, billingEmail: null, firstName: "Jean", lastName: "Dupont", entityType: "PERSONNE_PHYSIQUE", companyName: null } }) as never
    );

    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/);
  });

  it("envoie la facture avec succès", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ lines: [] }) as never);

    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
  });

  it("utilise le nom de société pour un locataire PERSONNE_MORALE avec billingEmail", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({
      lines: [],
      periodStart: null,
      tenant: {
        email: "contact@sci.fr",
        billingEmail: "billing@sci.fr",
        firstName: null,
        lastName: null,
        entityType: "PERSONNE_MORALE",
        companyName: "SCI Dupont",
      },
    }) as never);

    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
  });

  it("retourne une erreur si l'email échoue (ligne 409)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ lines: [] }) as never);
    vi.mocked(sendInvoiceEmail).mockResolvedValueOnce({ success: false, error: "SMTP error" });

    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si rôle insuffisant pour sendInvoiceToTenant (lignes 422-423)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans sendInvoiceToTenant (lignes 424-426)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("mappe les lignes de facture dans l'email (ligne 406)", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({
      lines: [{ label: "Loyer mars 2025", totalTTC: 800 }],
    }) as never);

    const result = await sendInvoiceToTenant(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
  });
});

// ── validateInvoice ────────────────────────────────────────────

describe("validateInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await validateInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la facture n'est pas en brouillon", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null); // status != BROUILLON

    const result = await validateInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable|validée/);
  });

  it("valide la facture avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "BROUILLON" }) as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await validateInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "VALIDEE" }) })
    );
  });

  it("retourne une erreur si rôle insuffisant pour validateInvoice (lignes 463-464)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await validateInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans validateInvoice (lignes 465-466)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await validateInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la validation" });
  });
});

// ── validateBatchInvoices ──────────────────────────────────────

describe("validateBatchInvoices", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await validateBatchInvoices(SOCIETY_ID, [INVOICE_ID]);
    expect(result.success).toBe(false);
  });

  it("valide en masse avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 3 } as never);

    const result = await validateBatchInvoices(SOCIETY_ID, ["id1", "id2", "id3"]);
    expect(result.success).toBe(true);
    expect(result.data?.validated).toBe(3);
  });

  it("retourne une erreur si rôle insuffisant pour validateBatchInvoices (lignes 497-498)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await validateBatchInvoices(SOCIETY_ID, [INVOICE_ID]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans validateBatchInvoices (lignes 499-500)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.updateMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await validateBatchInvoices(SOCIETY_ID, [INVOICE_ID]);
    expect(result).toEqual({ success: false, error: "Erreur lors de la validation en masse" });
  });
});

// ── cancelInvoice ──────────────────────────────────────────────

describe("cancelInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si la facture est déjà annulée", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "ANNULEE", creditNotes: [] }) as never);

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/déjà annulée/);
  });

  it("retourne une erreur si la facture est payée", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "PAYE", creditNotes: [] }) as never);

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/payée/);
  });

  it("retourne une erreur si un avoir existe déjà", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ status: "ENVOYEE", creditNotes: [{ id: "avoir-1" }] }) as never
    );

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/avoir/);
  });

  it("annule un brouillon sans créer d'avoir", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "BROUILLON", creditNotes: [], lines: [] }) as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID, "Erreur de saisie");
    expect(result.success).toBe(true);
    expect(result.data?.creditNoteId).toBeUndefined();
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ANNULEE" }) })
    );
  });

  it("annule une facture ENVOYEE et crée un avoir", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ status: "ENVOYEE", creditNotes: [], lines: [
        { label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 },
      ] }) as never
    );
    prismaMock.$transaction.mockResolvedValue({ id: "avoir-id" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.creditNoteId).toBe("avoir-id");
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ANNULEE" }) })
    );
  });

  it("retourne une erreur si rôle insuffisant pour cancelInvoice", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans cancelInvoice", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de l'annulation" });
  });

  it("exécute le callback $transaction pour créer un avoir (lignes 530-531, 549)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(
      makeInvoice({ status: "ENVOYEE", creditNotes: [], lines: [
        { label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 },
      ] }) as never
    );
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
    prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "FAC" } as never);
    prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 1, invoicePrefix: "FAC" } as never);
    prismaMock.invoice.create.mockResolvedValue({ id: "avoir-id" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await cancelInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.creditNoteId).toBe("avoir-id");
    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoiceType: "AVOIR" }) })
    );
  });
});

// ── markAsLitigious ────────────────────────────────────────────

describe("markAsLitigious", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await markAsLitigious(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable ou statut incompatible", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await markAsLitigious(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable|incompatible/);
  });

  it("marque la facture en litigieux avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "EN_RETARD" }) as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await markAsLitigious(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "LITIGIEUX" } })
    );
  });

  it("retourne une erreur si rôle insuffisant pour markAsLitigious", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await markAsLitigious(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans markAsLitigious", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await markAsLitigious(SOCIETY_ID, INVOICE_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors du passage en litigieux" });
  });
});

// ── markAsIrrecoverable ────────────────────────────────────────

describe("markAsIrrecoverable", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await markAsIrrecoverable(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si facture introuvable ou statut incompatible", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await markAsIrrecoverable(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable|incompatible/);
  });

  it("marque la facture comme irrécouvrable avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ status: "LITIGIEUX" }) as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await markAsIrrecoverable(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "IRRECOUVRABLE" } })
    );
  });

  it("retourne une erreur si rôle insuffisant pour markAsIrrecoverable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await markAsIrrecoverable(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans markAsIrrecoverable", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await markAsIrrecoverable(SOCIETY_ID, INVOICE_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors du passage en irrécouvrable" });
  });
});

// ── generateAndSendQuittance ───────────────────────────────────

describe("generateAndSendQuittance", () => {
  it("retourne une erreur si la facture source est introuvable", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si ce n'est pas un appel de loyer", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice({ invoiceType: "AVOIR" }) as never);

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/loyer/);
  });

  it("retourne la quittance existante si elle existe déjà", async () => {
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(makeInvoice() as never)
      .mockResolvedValueOnce({ id: "quittance-existante" } as never);

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result.success).toBe(true);
    expect(result.data?.quittanceId).toBe("quittance-existante");
  });

  it("génère une nouvelle quittance avec succès", async () => {
    const QUITTANCE_ID = "clh3x2z4k0002qh8g7z1y2v3t";
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(makeInvoice() as never)
      .mockResolvedValueOnce(null as never);
    prismaMock.$transaction.mockResolvedValue({ id: QUITTANCE_ID } as never);
    prismaMock.payment.create.mockResolvedValue({} as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result.success).toBe(true);
    expect(result.data?.quittanceId).toBe(QUITTANCE_ID);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.payment.create).toHaveBeenCalledOnce();
  });

  it("exécute le callback $transaction pour créer une quittance (lignes 137-138, 154)", async () => {
    const QUITTANCE_ID = "clh3x2z4k0003qh8g7z1y2v3t";
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(makeInvoice({
        lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
      }) as never)
      .mockResolvedValueOnce(null as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
    prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "FAC" } as never);
    prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 5, invoicePrefix: "FAC" } as never);
    prismaMock.invoice.create.mockResolvedValue({ id: QUITTANCE_ID } as never);
    prismaMock.payment.create.mockResolvedValue({} as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result.success).toBe(true);
    expect(result.data?.quittanceId).toBe(QUITTANCE_ID);
    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoiceType: "QUITTANCE" }) })
    );
  });

  it("retourne une erreur générique si la BDD échoue dans generateAndSendQuittance (lignes 193-194)", async () => {
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(makeInvoice() as never)
      .mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result).toEqual({ success: false, error: "Erreur lors de la génération de la quittance" });
  });

  it("exécute generateQuittancePdfAndSend en arrière-plan — email envoyé (lignes 208-358)", async () => {
    const QUITTANCE_ID = "clh3x2z4k0005qh8g7z1y2v3u";
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce(makeInvoice({
        lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
      }) as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(makeFullQuittance(QUITTANCE_ID) as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
    prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "QIT" } as never);
    prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 2, invoicePrefix: "QIT" } as never);
    prismaMock.invoice.create.mockResolvedValue({ id: QUITTANCE_ID } as never);
    prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
    expect(result.success).toBe(true);

    await vi.waitFor(() => expect(sendReceiptEmailMock).toHaveBeenCalled(), { timeout: 5000 });
  });

  it("tente le téléchargement du logo si logoUrl et supabase configurés (lignes 244-257)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    try {
      const QUITTANCE_ID = "clh3x2z4k0007qh8g7z1y2v3w";
      const quittanceWithLogo = {
        ...makeFullQuittance(QUITTANCE_ID),
        society: { ...makeFullQuittance(QUITTANCE_ID).society, logoUrl: "logos/society-1/logo.png" },
      };
      prismaMock.invoice.findFirst
        .mockResolvedValueOnce(makeInvoice({
          lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
        }) as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(quittanceWithLogo as never);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
      prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "QIT" } as never);
      prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 2, invoicePrefix: "QIT" } as never);
      prismaMock.invoice.create.mockResolvedValue({ id: QUITTANCE_ID } as never);
      prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
      prismaMock.invoice.update.mockResolvedValue({} as never);
      prismaMock.document.create.mockResolvedValue({} as never);

      const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
      expect(result.success).toBe(true);

      // sendReceiptEmail is called after the logo block — if it was called, logo code was reached
      await vi.waitFor(() => expect(sendReceiptEmailMock).toHaveBeenCalled(), { timeout: 5000 });
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("upload PDF dans Supabase si configuré (lignes 328-356)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    try {
      const QUITTANCE_ID = "clh3x2z4k0006qh8g7z1y2v3v";
      prismaMock.invoice.findFirst
        .mockResolvedValueOnce(makeInvoice({
          lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
        }) as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(makeFullQuittance(QUITTANCE_ID) as never);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
      prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "QIT" } as never);
      prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 2, invoicePrefix: "QIT" } as never);
      prismaMock.invoice.create.mockResolvedValue({ id: QUITTANCE_ID } as never);
      prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
      prismaMock.invoice.update.mockResolvedValue({} as never);
      prismaMock.document.create.mockResolvedValue({} as never);

      const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
      expect(result.success).toBe(true);

      await vi.waitFor(() => expect(supabaseStorageMock.upload).toHaveBeenCalled(), { timeout: 5000 });
      expect(prismaMock.document.create).toHaveBeenCalled();
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("convertit le logo en base64 si download retourne un blob (lignes 253-257)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    try {
      const QUITTANCE_ID = "clh3x2z4k0009qh8g7z1y2v3y";
      const fakeBlob = { arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-png-data").buffer) };
      supabaseStorageMock.download.mockResolvedValueOnce({ data: fakeBlob });

      const quittanceWithLogo = {
        ...makeFullQuittance(QUITTANCE_ID),
        society: { ...makeFullQuittance(QUITTANCE_ID).society, logoUrl: "logos/society-1/logo.png" },
      };
      prismaMock.invoice.findFirst
        .mockResolvedValueOnce(makeInvoice({
          lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
        }) as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(quittanceWithLogo as never);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
      prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "QIT" } as never);
      prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 2, invoicePrefix: "QIT" } as never);
      prismaMock.invoice.create.mockResolvedValue({ id: QUITTANCE_ID } as never);
      prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
      prismaMock.invoice.update.mockResolvedValue({} as never);
      prismaMock.document.create.mockResolvedValue({} as never);

      const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
      expect(result.success).toBe(true);
      await vi.waitFor(() => expect(renderToBufferMock).toHaveBeenCalled(), { timeout: 5000 });
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("parse le storagePath depuis une URL http complète (lignes 247-249)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    try {
      const QUITTANCE_ID = "clh3x2z4k000aqh8g7z1y2v3z";
      const httpLogoUrl =
        "https://supabase.example.com/storage/v1/object/public/documents/logos/logo.jpeg";
      const fakeBlob = { arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("jpeg-data").buffer) };
      supabaseStorageMock.download.mockResolvedValueOnce({ data: fakeBlob });

      const quittanceWithLogo = {
        ...makeFullQuittance(QUITTANCE_ID),
        society: { ...makeFullQuittance(QUITTANCE_ID).society, logoUrl: httpLogoUrl },
      };
      prismaMock.invoice.findFirst
        .mockResolvedValueOnce(makeInvoice({
          lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
        }) as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(quittanceWithLogo as never);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
      prismaMock.society.findUnique.mockResolvedValue({ invoiceNumberYear: 2025, invoicePrefix: "QIT" } as never);
      prismaMock.society.update.mockResolvedValue({ nextInvoiceNumber: 2, invoicePrefix: "QIT" } as never);
      prismaMock.invoice.create.mockResolvedValue({ id: QUITTANCE_ID } as never);
      prismaMock.payment.create.mockResolvedValue({ id: "payment-1" } as never);
      prismaMock.invoice.update.mockResolvedValue({} as never);
      prismaMock.document.create.mockResolvedValue({} as never);

      const result = await generateAndSendQuittance(SOCIETY_ID, INVOICE_ID, new Date());
      expect(result.success).toBe(true);
      await vi.waitFor(() => expect(supabaseStorageMock.download).toHaveBeenCalledWith("logos/logo.jpeg"), { timeout: 5000 });
    } finally {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });
});
