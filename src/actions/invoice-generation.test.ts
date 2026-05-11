import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const mockComputeLines = vi.hoisted(() =>
  vi.fn().mockReturnValue([
    { label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0, totalHT: 800, totalVAT: 0, totalTTC: 800 },
  ])
);
const mockGetNextInvoiceNumber = vi.hoisted(() => vi.fn().mockResolvedValue("FAC-2025-001"));
const mockGetNextCreditNoteNumber = vi.hoisted(() => vi.fn().mockResolvedValue("AV-2025-001"));
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
  getNextCreditNoteNumber: mockGetNextCreditNoteNumber,
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
  prismaMock.invoice.findMany.mockResolvedValue([] as never);
  prismaMock.invoiceGenerationExclusion.findMany.mockResolvedValue([] as never);
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

  it("revalide le chemin du bail si leaseId fourni (ligne 95)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      leaseId: LEASE_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("retourne une erreur si checkSubscriptionActive échoue (ligne 43)", async () => {
    const { checkSubscriptionActive } = await import("@/lib/plan-limits");
    vi.mocked(checkSubscriptionActive).mockResolvedValueOnce({ active: false, message: "Abonnement inactif" } as never);
    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Abonnement inactif");
  });

  it("retourne une erreur si rôle insuffisant pour createInvoice (ligne 101)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createInvoice (ligne 102)", async () => {
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la création de la facture" });
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

  it("retourne une erreur Zod si leaseId invalide (ligne 115)", async () => {
    const result = await previewInvoiceFromLease(SOCIETY_ID, {
      leaseId: "not-a-cuid",
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si rôle insuffisant pour previewInvoiceFromLease (ligne 123)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await previewInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si computeInvoicePreview lève une exception (lignes 124-125)", async () => {
    mockComputeInvoicePreview.mockRejectedValueOnce(new Error("DB error"));
    const result = await previewInvoiceFromLease(SOCIETY_ID, {
      leaseId: LEASE_ID,
      periodMonth: "2025-01",
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la prévisualisation" });
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
    // Le numéro est alloué à la validation, pas à la création du brouillon
    expect(result.data?.id).toBeDefined();
  });

  it("applique le prorata si bail débuté en cours de mois (lignes 250-255)", async () => {
    // startDate = 15 janvier 2025 : même mois/année que periodStart (2025-01-01) → prorata
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2025-01-15"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("applique la franchise partielle si rentFreeMonths décimal (lignes 261-271)", async () => {
    // startDate = 1er décembre 2024, rentFreeMonths = 1.5 → monthsSinceLease = 1 = Math.floor(1.5)
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-12-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 1.5, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("utilise les lignes de révision prorata si buildRevisionProrataLines non null (lignes 309-310)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    mockBuildRevisionProrataLines.mockResolvedValueOnce({
      lines: [{ label: "Révision loyer", quantity: 1, unitPrice: 50, vatRate: 0, totalHT: 50, totalVAT: 0, totalTTC: 50 }],
      rentHT: 850,
    });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("inclut les provisions sur charges dans la facture (lignes 325-328)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [],
      chargeProvisions: [{ monthlyAmount: 100, vatRate: 20, label: "Provisions charges" }],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("calcule les honoraires de gestion tiers et met à jour la facture (lignes 366-372)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: true, managementFeeType: "POURCENTAGE",
      managementFeeValue: 8, managementFeeBasis: "LOYER_CC", managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalled();
  });

  it("calcule chargeProvisions avec fréquence non-mensuelle pour gestion tiers (lignes 367-368)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "TRIMESTRIEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: true, managementFeeType: "POURCENTAGE",
      managementFeeValue: 8, managementFeeBasis: "LOYER_CC", managementFeeVatRate: 20,
      rentSteps: [],
      chargeProvisions: [{ monthlyAmount: 50, vatRate: 20, label: "Charges" }],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalled();
  });

  it("retourne une erreur si rôle insuffisant pour generateInvoiceFromLease (lignes 407-408)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans generateInvoiceFromLease (lignes 409-410)", async () => {
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la génération de la facture" });
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
    prismaMock.invoice.findMany.mockResolvedValue([{
      leaseId: LEASE_ID,
      periodStart: new Date("2025-01-01"),
      periodEnd: new Date("2025-01-31"),
    }] as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.created).toBe(0);
  });

  it("ignore les baux exclus pour la période de génération", async () => {
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
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.invoiceGenerationExclusion.findMany.mockResolvedValue([
      {
        leaseId: LEASE_ID,
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-01-31"),
      },
    ] as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.created).toBe(0);
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
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

  it("capture l'erreur par bail si invoice.create échoue (lignes 592-593)", async () => {
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
    prismaMock.invoice.create.mockRejectedValue(new Error("Transaction failed"));

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

  it("retourne une erreur Zod si le format de mois est invalide pour generateBatchInvoices (lignes 426, 428)", async () => {
    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "bad-month" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("AAAA-MM");
  });

  it("utilise les lignes de révision prorata dans generateBatchInvoices (ligne 535)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([{
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false, rentSteps: [], chargeProvisions: [],
      lot: { number: "1", building: { name: "Immeuble A" } },
    }] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    mockBuildRevisionProrataLines.mockResolvedValueOnce({
      lines: [{ label: "Révision", quantity: 1, unitPrice: 50, vatRate: 0, totalHT: 50, totalVAT: 0, totalTTC: 50 }],
      rentHT: 850,
    });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("inclut les provisions sur charges dans generateBatchInvoices (lignes 550-553)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([{
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false, rentSteps: [],
      chargeProvisions: [{ monthlyAmount: 100, vatRate: 20, label: "Charges" }],
      lot: { number: "1", building: { name: "Immeuble A" } },
    }] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("exécute le callback $transaction dans generateBatchInvoices (lignes 569-570)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([{
      id: LEASE_ID, tenantId: TENANT_ID, startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false, rentSteps: [], chargeProvisions: [],
      lot: { number: "1", building: { name: "Immeuble A" } },
    }] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
    expect(prismaMock.invoice.create).toHaveBeenCalled();
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

  it("retourne une erreur si rôle insuffisant pour previewBatchInvoices (ligne 153)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    const r = await previewBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans previewBatchInvoices (lignes 154-155)", async () => {
    prismaMock.lease.findMany.mockRejectedValue(new Error("DB error"));
    const r = await previewBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(r).toEqual({ success: false, error: "Erreur lors de la prévisualisation" });
  });
});

// ── Branches manquantes ───────────────────────────────────────────

describe("createInvoice — branches restantes", () => {
  it("retourne une erreur Zod si tenantId invalide (B1 arm0)", async () => {
    const result = await createInvoice(SOCIETY_ID, {
      tenantId: "not-a-cuid",
      dueDate: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("crée une facture avec periodStart et periodEnd renseignés (B4/B5 arm0)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: TENANT_ID } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await createInvoice(SOCIETY_ID, {
      tenantId: TENANT_ID,
      dueDate: "2025-01-31",
      periodStart: "2025-01-01",
      periodEnd: "2025-01-31",
      invoiceType: "APPEL_LOYER",
      lines: [{ label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("generateInvoiceFromLease — branches restantes", () => {
  it("retourne une erreur Zod si leaseId invalide (B18 arm0)", async () => {
    const result = await generateInvoiceFromLease(SOCIETY_ID, {
      leaseId: "not-a-cuid",
      periodMonth: "2025-01",
    });
    expect(result.success).toBe(false);
  });

  it("traite rentFreeMonths null (B21/B25 arm1)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: null, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("n'applique pas la franchise si le mois de la période ne correspond pas (B28 arm1)", async () => {
    // startDate=2024-10-01, rentFreeMonths=1.5 → monthsSinceLease(2025-01)=3, Math.floor(1.5)=1 → 3≠1
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-10-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 1.5, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("applique la TVA si vatApplicable est true (B29 arm0)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: true, vatRate: 20,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("utilise 'Lot non précisé' si lot est null (B30 arm1)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: null,
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("utilise mult=1 si paymentFrequency inconnu (B31 arm1)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "INCONNU", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: false, managementFeeType: null, managementFeeValue: null,
      managementFeeBasis: null, managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
  });

  it("utilise mult=1 si paymentFrequency inconnu dans isThirdPartyManaged (B34 arm1)", async () => {
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "INCONNU", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: true, managementFeeType: "POURCENTAGE",
      managementFeeValue: 8, managementFeeBasis: "LOYER_CC", managementFeeVatRate: 20,
      rentSteps: [],
      chargeProvisions: [{ monthlyAmount: 50, vatRate: 20, label: "Charges" }],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).toHaveBeenCalled();
  });

  it("ne met pas à jour la facture si feeTTC = 0 (B35 arm1)", async () => {
    mockComputeManagementFee.mockReturnValueOnce({ feeHT: 0, feeVAT: 0, feeTTC: 0 });
    prismaMock.lease.findFirst.mockResolvedValue({
      id: LEASE_ID, tenantId: TENANT_ID,
      startDate: new Date("2024-01-01"),
      paymentFrequency: "MENSUEL", billingTerm: "ECHU",
      currentRentHT: 800, vatApplicable: false, vatRate: 0,
      rentFreeMonths: 0, progressiveRent: false,
      isThirdPartyManaged: true, managementFeeType: "POURCENTAGE",
      managementFeeValue: 0, managementFeeBasis: "LOYER_CC", managementFeeVatRate: 20,
      rentSteps: [], chargeProvisions: [],
      lot: { number: "12", building: { name: "Résidence Les Pins" } },
    } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID, invoiceNumber: "FAC-2025-001" } as never);

    const result = await generateInvoiceFromLease(SOCIETY_ID, { leaseId: LEASE_ID, periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });
});

describe("generateBatchInvoices — branches restantes", () => {
  const makeBaseLease = (overrides: Record<string, unknown> = {}) => ({
    id: LEASE_ID, tenantId: TENANT_ID,
    startDate: new Date("2024-01-01"),
    paymentFrequency: "MENSUEL", billingTerm: "ECHU",
    currentRentHT: 800, vatApplicable: false, vatRate: 0,
    rentFreeMonths: 0, progressiveRent: false,
    rentSteps: [], chargeProvisions: [],
    lot: { number: "1", building: { name: "Immeuble A" } },
    ...overrides,
  });

  it("filtre par leaseIds si spécifiés (B39 arm0)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeBaseLease()] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01", leaseIds: [LEASE_ID] });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
    expect(prismaMock.lease.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [LEASE_ID] } }) })
    );
  });

  it("traite rentFreeMonths null dans generateBatchInvoices (B41 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeBaseLease({ rentFreeMonths: null })] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("applique la TVA si vatApplicable est true dans generateBatchInvoices (B42 arm0)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeBaseLease({ vatApplicable: true, vatRate: 20 })] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("utilise 'Lot non précisé' si lot est null dans generateBatchInvoices (B43 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeBaseLease({ lot: null })] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("utilise mult=1 si paymentFrequency inconnu dans generateBatchInvoices (B44 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeBaseLease({ paymentFrequency: "INCONNU" })] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: INVOICE_ID } as never);

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("capture 'Erreur inconnue' si l'erreur n'est pas une instance de Error (B46 arm1)", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeBaseLease()] as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.invoice.create.mockRejectedValue("string-error");

    const result = await generateBatchInvoices(SOCIETY_ID, { periodMonth: "2025-01" });
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toContain("Erreur inconnue");
  });
});
