import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue({ success: true }),
}));
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
});
