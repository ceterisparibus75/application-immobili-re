import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const mockComputeLines = vi.hoisted(() =>
  vi.fn().mockReturnValue([
    { label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 },
  ])
);
const mockGetNextInvoiceNumber = vi.hoisted(() => vi.fn().mockResolvedValue("FAC-2025-001"));
const mockComputePeriodDates = vi.hoisted(() =>
  vi.fn().mockReturnValue({ periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-01-31") })
);
const mockComputeIssueDueDate = vi.hoisted(() =>
  vi.fn().mockReturnValue({ issueDate: new Date("2025-01-01"), dueDate: new Date("2025-01-31") })
);
const mockComputeRentForPeriod = vi.hoisted(() => vi.fn().mockReturnValue(800));
const mockComputeManagementFee = vi.hoisted(() =>
  vi.fn().mockReturnValue({ feeHT: 64, feeVAT: 12.8, feeTTC: 76.8 })
);
const mockBuildRevisionProrataLines = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockComputeInvoicePreview = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    leaseId: "lease-1",
    lines: [],
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-31"),
    totalHT: 800,
    totalVAT: 0,
    totalTTC: 800,
  })
);

vi.mock("./invoice-shared", () => ({
  computeLines: mockComputeLines,
  getNextInvoiceNumber: mockGetNextInvoiceNumber,
  computePeriodDates: mockComputePeriodDates,
  computeIssueDueDate: mockComputeIssueDueDate,
  computeRentForPeriod: mockComputeRentForPeriod,
  computeManagementFee: mockComputeManagementFee,
  buildRevisionProrataLines: mockBuildRevisionProrataLines,
  computeInvoicePreview: mockComputeInvoicePreview,
}));

import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import {
  createInvoice,
  previewInvoiceFromLease,
  previewBatchInvoices,
  generateInvoiceFromLease,
  generateBatchInvoices,
  createCreditNote,
} from "./invoice-generation";

const SOCIETY_ID = "clh3x2z4k0001qh8g7z1y2v3t";
const TENANT_ID = "clh3x2z4k0002qh8g7z1y2v3t";
const LEASE_ID = "clh3x2z4k0003qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0004qh8g7z1y2v3t";

beforeEach(() => {
  mockAuthSession("COMPTABLE", SOCIETY_ID);
});

// ── createInvoice ─────────────────────────────────────────────────

describe("createInvoice", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le locataire est introuvable", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Locataire introuvable");
  });

  it("crée une facture avec succès", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "FAC-2025-001",
    } as never);

    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(INVOICE_ID);
  });
});

// ── previewInvoiceFromLease ───────────────────────────────────────

describe("previewInvoiceFromLease", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await previewInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le bail est introuvable", async () => {
    mockComputeInvoicePreview.mockResolvedValueOnce(null);
    const result = await previewInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne un aperçu avec succès", async () => {
    const result = await previewInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(true);
    expect(result.data?.totalTTC).toBe(800);
  });
});

// ── generateInvoiceFromLease ──────────────────────────────────────

describe("generateInvoiceFromLease", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await generateInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le bail actif est introuvable", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(null);
    const result = await generateInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si une facture existe déjà pour la période", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL",
      billingTerm: "ECHU",
      currentRentHT: 800,
      vatApplicable: false,
      vatRate: 0,
      rentFreeMonths: 0,
      progressiveRent: false,
      isThirdPartyManaged: false,
      managementFeeType: null,
      managementFeeValue: null,
      managementFeeBasis: null,
      managementFeeVatRate: 20,
      rentSteps: [],
      chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "existing-inv",
      invoiceNumber: "FAC-2025-001",
    } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("FAC-2025-001");
  });

  it("génère une facture avec succès", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID,
      tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL",
      billingTerm: "ECHU",
      currentRentHT: 800,
      vatApplicable: false,
      vatRate: 0,
      rentFreeMonths: 0,
      progressiveRent: false,
      isThirdPartyManaged: false,
      managementFeeType: null,
      managementFeeValue: null,
      managementFeeBasis: null,
      managementFeeVatRate: 20,
      rentSteps: [],
      chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "FAC-2025-001",
    } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(true);
    expect(result.data?.invoiceNumber).toBe("FAC-2025-001");
  });
});

// ── generateBatchInvoices ─────────────────────────────────────────

describe("generateBatchInvoices", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(false);
  });

  it("retourne 0 créées si aucun bail actif", async () => {
    prismaMock.lease.findMany.mockResolvedValue([]);
    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(0);
    expect(result.data?.skipped).toBe(0);
  });

  it("compte les bails ignorés si une facture existe déjà", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: LEASE_ID,
        tenantId: TENANT_ID,
        startDate: new Date("2024-01-01"),
        paymentFrequency: "MENSUEL",
        billingTerm: "ECHU",
        currentRentHT: 800,
        vatApplicable: false,
        vatRate: 0,
        rentFreeMonths: 0,
        progressiveRent: false,
        rentSteps: [],
        chargeProvisions: [],
        lot: { number: "1", building: { name: "Immeuble A" } },
      },
    ] as never);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "existing" } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.created).toBe(0);
  });

  it("crée une facture et déclenche l'audit log si created > 0", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: LEASE_ID,
        tenantId: TENANT_ID,
        startDate: new Date("2024-01-01"),
        paymentFrequency: "MENSUEL",
        billingTerm: "ECHU",
        currentRentHT: 800,
        vatApplicable: false,
        vatRate: 0,
        rentFreeMonths: 0,
        progressiveRent: false,
        rentSteps: [],
        chargeProvisions: [],
        lot: { number: "1", building: { name: "Immeuble A" } },
      },
    ] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue({} as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
    expect(result.data?.skipped).toBe(0);
  });

  it("retourne une erreur si non authentifié pour generateBatchInvoices (UnauthenticatedActionError)", async () => {
    mockUnauthenticated();
    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si rôle insuffisant pour generateBatchInvoices (ForbiddenError ligne 619)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("capture l'erreur par bail si $transaction échoue (lignes 592-593)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: LEASE_ID,
        tenantId: TENANT_ID,
        startDate: new Date("2024-01-01"),
        paymentFrequency: "MENSUEL",
        billingTerm: "ECHU",
        currentRentHT: 800,
        vatApplicable: false,
        vatRate: 0,
        rentFreeMonths: 0,
        progressiveRent: false,
        rentSteps: [],
        chargeProvisions: [],
        lot: { number: "1", building: { name: "Immeuble A" } },
      },
    ] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValue(new Error("Transaction failed"));

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(0);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toContain("Transaction failed");
  });

  it("retourne une erreur générique si la BDD échoue dans generateBatchInvoices", async () => {
    prismaMock.lease.findMany.mockRejectedValue(new Error("DB connection lost"));
    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la génération en masse" });
  });
});

// ── createCreditNote ──────────────────────────────────────────────

describe("createCreditNote", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la facture originale est introuvable", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si la facture est déjà un avoir", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceType: "AVOIR",
      lines: [],
    } as never);
    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("avoir sur un avoir");
  });

  it("retourne une erreur si un avoir existe déjà", async () => {
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce({
        id: INVOICE_ID,
        invoiceType: "APPEL_LOYER",
        totalHT: 800,
        totalVAT: 0,
        totalTTC: 800,
        periodStart: null,
        periodEnd: null,
        tenantId: TENANT_ID,
        leaseId: null,
        lines: [],
      } as never)
      .mockResolvedValueOnce({ id: "avoir-id", invoiceNumber: "AV-2025-001" } as never);

    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("AV-2025-001");
  });

  it("crée un avoir avec succès", async () => {
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce({
        id: INVOICE_ID,
        invoiceType: "APPEL_LOYER",
        invoiceNumber: "FAC-2025-001",
        totalHT: 800,
        totalVAT: 0,
        totalTTC: 800,
        periodStart: null,
        periodEnd: null,
        tenantId: TENANT_ID,
        leaseId: null,
        lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 }],
      } as never)
      .mockResolvedValueOnce(null);

    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({
      id: "avoir-id",
      invoiceNumber: "AV-2025-001",
    } as never);

    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(true);
    expect(result.data?.invoiceNumber).toBe("AV-2025-001");
  });

  it("retourne une erreur si validation Zod échoue (originalInvoiceId invalide)", async () => {
    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: "not-a-cuid",
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si rôle insuffisant pour createCreditNote", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createCreditNote", async () => {
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await createCreditNote(SOCIETY_ID, {
      originalInvoiceId: INVOICE_ID,
      dueDate: "2025-02-28",
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de l'émission de l'avoir" });
  });
});

// ── previewBatchInvoices ──────────────────────────────────────────

describe("previewBatchInvoices", () => {
  const validInput = { periodMonth: "2025-01", leaseIds: [LEASE_ID] };

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await previewBatchInvoices(SOCIETY_ID, validInput);
    expect(r.success).toBe(false);
  });

  it("retourne une erreur si le format de mois est invalide", async () => {
    const r = await previewBatchInvoices(SOCIETY_ID, { periodMonth: "2025-13" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("AAAA-MM");
  });

  it("retourne les prévisualisations pour les baux spécifiés", async () => {
    const r = await previewBatchInvoices(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(mockComputeInvoicePreview).toHaveBeenCalledWith(SOCIETY_ID, LEASE_ID, "2025-01");
  });

  it("récupère tous les baux actifs si aucun leaseId spécifié", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      { id: LEASE_ID },
      { id: "clh3x2z4k0005qh8g7z1y2v3t" },
    ] as never);
    const r = await previewBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(2);
    expect(prismaMock.lease.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: SOCIETY_ID, status: "EN_COURS" } })
    );
  });

  it("ignore les baux sans prévisualisation (computeInvoicePreview retourne null)", async () => {
    mockComputeInvoicePreview.mockResolvedValueOnce(null);
    const r = await previewBatchInvoices(SOCIETY_ID, validInput);
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(0);
  });
});
