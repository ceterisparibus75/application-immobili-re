import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null }) })) },
  })),
}));
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, "")),
}));

import { prismaMock } from "@/test/mocks/prisma";

import {
  computeLines,
  computePeriodDates,
  computeIssueDueDate,
  computeRentForPeriod,
  computeManagementFee,
  getNextInvoiceNumber,
  buildRevisionProrataLines,
  computeInvoicePreview,
} from "./invoice-shared";

// ── computeLines ───────────────────────────────────────────────

describe("computeLines", () => {
  it("calcule les totaux HT, TVA et TTC de chaque ligne", () => {
    const lines = computeLines([
      { label: "Loyer", quantity: 1, unitPrice: 800, vatRate: 0 },
      { label: "Charges", quantity: 1, unitPrice: 100, vatRate: 20 },
    ]);
    expect(lines[0]).toMatchObject({ totalHT: 800, totalVAT: 0, totalTTC: 800 });
    expect(lines[1]).toMatchObject({ totalHT: 100, totalVAT: 20, totalTTC: 120 });
  });

  it("préserve les propriétés d'origine", () => {
    const [line] = computeLines([{ label: "Test", quantity: 2, unitPrice: 50, vatRate: 10 }]);
    expect(line.label).toBe("Test");
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(50);
    expect(line.vatRate).toBe(10);
    expect(line.totalHT).toBe(100);
    expect(line.totalVAT).toBe(10);
    expect(line.totalTTC).toBe(110);
  });

  it("retourne un tableau vide si l'entrée est vide", () => {
    expect(computeLines([])).toHaveLength(0);
  });
});

// ── computePeriodDates ─────────────────────────────────────────

describe("computePeriodDates", () => {
  it("calcule les dates pour MENSUEL", () => {
    const { periodStart, periodEnd } = computePeriodDates("2025-03", "MENSUEL");
    expect(periodStart).toEqual(new Date(2025, 2, 1)); // 1er mars
    expect(periodEnd).toEqual(new Date(2025, 3, 0));  // 31 mars
  });

  it("calcule les dates pour TRIMESTRIEL (Q1)", () => {
    const { periodStart, periodEnd } = computePeriodDates("2025-02", "TRIMESTRIEL");
    expect(periodStart).toEqual(new Date(2025, 0, 1)); // 1er janvier
    expect(periodEnd).toEqual(new Date(2025, 3, 0));  // 31 mars
  });

  it("calcule les dates pour TRIMESTRIEL (Q3)", () => {
    const { periodStart, periodEnd } = computePeriodDates("2025-08", "TRIMESTRIEL");
    expect(periodStart).toEqual(new Date(2025, 6, 1)); // 1er juillet
    expect(periodEnd).toEqual(new Date(2025, 9, 0));  // 30 septembre
  });

  it("calcule les dates pour SEMESTRIEL (S1)", () => {
    const { periodStart, periodEnd } = computePeriodDates("2025-04", "SEMESTRIEL");
    expect(periodStart).toEqual(new Date(2025, 0, 1)); // 1er janvier
    expect(periodEnd).toEqual(new Date(2025, 6, 0));  // 30 juin
  });

  it("calcule les dates pour ANNUEL", () => {
    const { periodStart, periodEnd } = computePeriodDates("2025-06", "ANNUEL");
    expect(periodStart).toEqual(new Date(2025, 0, 1)); // 1er janvier
    expect(periodEnd).toEqual(new Date(2025, 12, 0)); // 31 décembre
  });
});

// ── computeIssueDueDate ────────────────────────────────────────

describe("computeIssueDueDate", () => {
  it("pour A_ECHOIR : l'échéance est le début de période", () => {
    const periodStart = new Date(2025, 0, 1);
    const periodEnd = new Date(2025, 0, 31);
    const { dueDate } = computeIssueDueDate(periodStart, periodEnd, "A_ECHOIR");
    expect(dueDate).toEqual(periodStart);
  });

  it("pour ECHU : l'échéance est le lendemain de la fin de période", () => {
    const periodStart = new Date(2025, 0, 1);
    const periodEnd = new Date(2025, 0, 31);
    const { dueDate } = computeIssueDueDate(periodStart, periodEnd, "ECHU");
    expect(dueDate.getDate()).toBe(1); // 1er février
    expect(dueDate.getMonth()).toBe(1);
  });

  it("la date d'émission est proche de maintenant", () => {
    const before = new Date();
    const { issueDate } = computeIssueDueDate(new Date(), new Date(), "A_ECHOIR");
    const after = new Date();
    expect(issueDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
    expect(issueDate.getTime()).toBeLessThanOrEqual(after.getTime() + 100);
  });
});

// ── computeRentForPeriod ───────────────────────────────────────

describe("computeRentForPeriod", () => {
  const PAST_START = new Date(2020, 0, 1); // bail démarré en 2020

  it("retourne le loyer courant sans franchise ni palier", () => {
    const rent = computeRentForPeriod(PAST_START, 800, null, 0);
    expect(rent).toBe(800);
  });

  it("retourne 0 si la période est dans la franchise (mois entiers)", () => {
    // bail qui a commencé ce mois-ci
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const rent = computeRentForPeriod(start, 800, null, 1);
    expect(rent).toBe(0);
  });

  it("applique le palier de loyer correspondant à la date actuelle", () => {
    const step = {
      startDate: new Date(2020, 0, 1),
      endDate: null,
      rentHT: 950,
    };
    const rent = computeRentForPeriod(PAST_START, 800, null, 0, [step]);
    expect(rent).toBe(950);
  });

  it("applique le loyer progressif pour le bon mois", () => {
    const now = new Date();
    const start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    // Le bail a ~12 mois → la 2e période progressive s'applique
    const progressive = [
      { months: 6, rentHT: 600 },
      { months: 12, rentHT: 750 },
    ];
    const rent = computeRentForPeriod(start, 800, progressive, 0);
    // 12 mois depuis start → on est dans la 2e plage (600+750=1350 → mois < 18)
    expect(rent).toBe(750);
  });
});

// ── computeManagementFee ───────────────────────────────────────

describe("computeManagementFee", () => {
  it("retourne 0 si pas de frais configurés", () => {
    const result = computeManagementFee(
      { managementFeeType: null, managementFeeValue: null, managementFeeBasis: null, managementFeeVatRate: null },
      800, 100, 1080
    );
    expect(result).toEqual({ feeHT: 0, feeVAT: 0, feeTTC: 0 });
  });

  it("calcule un forfait fixe", () => {
    const result = computeManagementFee(
      { managementFeeType: "FORFAIT", managementFeeValue: 50, managementFeeBasis: null, managementFeeVatRate: 20 },
      800, 100, 1080
    );
    expect(result.feeHT).toBe(50);
    expect(result.feeVAT).toBe(10);
    expect(result.feeTTC).toBe(60);
  });

  it("calcule un pourcentage sur le loyer HT", () => {
    const result = computeManagementFee(
      { managementFeeType: "POURCENTAGE", managementFeeValue: 10, managementFeeBasis: "LOYER_HT", managementFeeVatRate: 20 },
      800, 100, 1080
    );
    expect(result.feeHT).toBe(80); // 10% de 800
    expect(result.feeVAT).toBe(16);
    expect(result.feeTTC).toBe(96);
  });

  it("calcule un pourcentage sur loyer + charges HT", () => {
    const result = computeManagementFee(
      { managementFeeType: "POURCENTAGE", managementFeeValue: 10, managementFeeBasis: "LOYER_CHARGES_HT", managementFeeVatRate: 20 },
      800, 100, 1080
    );
    expect(result.feeHT).toBe(90); // 10% de (800+100)
  });

  it("calcule un pourcentage sur le TTC", () => {
    const result = computeManagementFee(
      { managementFeeType: "POURCENTAGE", managementFeeValue: 10, managementFeeBasis: "TTC", managementFeeVatRate: 20 },
      800, 100, 1080
    );
    expect(result.feeHT).toBe(108); // 10% de 1080
  });

  it("utilise 20% comme taux de TVA par défaut", () => {
    const result = computeManagementFee(
      { managementFeeType: "FORFAIT", managementFeeValue: 100, managementFeeBasis: null, managementFeeVatRate: null },
      0, 0, 0
    );
    expect(result.feeVAT).toBe(20);
  });
});

// ── getNextInvoiceNumber ───────────────────────────────────────────

describe("getNextInvoiceNumber", () => {
  const currentYear = new Date().getFullYear();

  it("génère un numéro avec le préfixe et l'année courante", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      invoiceNumberYear: currentYear,
      nextInvoiceNumber: 4,
      invoicePrefix: "FAC",
    } as never);
    prismaMock.society.update.mockResolvedValue({
      nextInvoiceNumber: 5,
      invoicePrefix: "FAC",
    } as never);

    const num = await getNextInvoiceNumber("society-1", prismaMock as never);
    expect(num).toBe(`FAC-${currentYear}-0005`);
  });

  it("repart à 1 si l'année a changé", async () => {
    prismaMock.society.findUnique.mockResolvedValue({
      invoiceNumberYear: 2023,
      nextInvoiceNumber: 99,
      invoicePrefix: "INV",
    } as never);
    prismaMock.society.update.mockResolvedValue({
      nextInvoiceNumber: 1,
      invoicePrefix: "INV",
    } as never);

    const num = await getNextInvoiceNumber("society-1", prismaMock as never);
    expect(num).toBe(`INV-${currentYear}-0001`);
  });

  it("utilise le préfixe FAC si aucun préfixe défini", async () => {
    prismaMock.society.findUnique.mockResolvedValue(null as never);
    prismaMock.society.update.mockResolvedValue({
      nextInvoiceNumber: 1,
      invoicePrefix: null,
    } as never);

    const num = await getNextInvoiceNumber("society-1", prismaMock as never);
    expect(num).toBe(`FAC-${currentYear}-0001`);
  });
});

// ── buildRevisionProrataLines ─────────────────────────────────────

describe("buildRevisionProrataLines", () => {
  const LEASE_ID = "clh3x2z4k0000qh8g7z1y2v3t";
  const periodStart = new Date("2025-01-01");
  const periodEnd = new Date("2025-01-31");

  it("retourne null si aucune révision dans la période", async () => {
    prismaMock.rentRevision.findFirst.mockResolvedValue(null);
    const r = await buildRevisionProrataLines(LEASE_ID, periodStart, periodEnd, 0, "Lot A", "janvier 2025");
    expect(r).toBeNull();
  });

  it("retourne 2 lignes proratisées si révision dans la période", async () => {
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      effectiveDate: new Date("2025-01-15"),
      previousRentHT: 800,
      newRentHT: 900,
    } as never);

    const r = await buildRevisionProrataLines(LEASE_ID, periodStart, periodEnd, 0, "Lot A", "janvier 2025");
    expect(r).not.toBeNull();
    expect(r?.lines).toHaveLength(2);
    expect(r?.lines[0].label).toContain("avant révision");
    expect(r?.lines[1].label).toContain("révisé au");
    expect(r?.rentHT).toBeGreaterThan(0);
  });

  it("applique la TVA sur les montants proratisés", async () => {
    prismaMock.rentRevision.findFirst.mockResolvedValue({
      effectiveDate: new Date("2025-01-16"),
      previousRentHT: 1000,
      newRentHT: 1200,
    } as never);

    const r = await buildRevisionProrataLines(LEASE_ID, periodStart, periodEnd, 20, "Lot B", "janvier 2025");
    expect(r).not.toBeNull();
    // Vérifier que la TVA est appliquée (vatRate = 20%)
    const line1 = r?.lines[0];
    expect(line1?.totalVAT).toBeGreaterThan(0);
    expect(line1?.totalTTC).toBeCloseTo((line1?.totalHT ?? 0) * 1.2, 2);
  });
});

// ── computeInvoicePreview ──────────────────────────────────────────────────────

const PREVIEW_LEASE_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const SOCIETY_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const TENANT_ID = "clh3x2z4k0002qh8g7z1y2v3v";

function makeLease(overrides = {}) {
  return {
    id: PREVIEW_LEASE_ID,
    tenantId: TENANT_ID,
    startDate: new Date("2024-01-01"),
    paymentFrequency: "MENSUEL",
    billingTerm: "A_ECHOIR",
    currentRentHT: 800,
    vatApplicable: false,
    vatRate: 0,
    rentFreeMonths: 0,
    progressiveRent: null,
    rentSteps: [],
    chargeProvisions: [],
    tenant: {
      entityType: "PERSONNE_PHYSIQUE",
      companyName: null,
      firstName: "Jean",
      lastName: "Dupont",
      personalAddress: "1 rue de la Paix, 75001 Paris",
      companyAddress: null,
      email: "jean@example.com",
      billingEmail: null,
      phone: null,
    },
    lot: {
      number: "A101",
      building: { name: "Immeuble Test", addressLine1: "1 rue Test", postalCode: "75001", city: "Paris", country: "France" },
    },
    ...overrides,
  };
}

function makeSociety(overrides = {}) {
  return {
    name: "SCI Test",
    logoUrl: null,
    siret: "12345678901234",
    vatNumber: null,
    vatRegime: "FRANCHISE",
    addressLine1: "1 rue Test",
    addressLine2: null,
    postalCode: "75001",
    city: "Paris",
    legalMentions: null,
    bankName: null,
    signatoryName: null,
    ibanEncrypted: null,
    bicEncrypted: null,
    phone: null,
    legalForm: "SCI",
    shareCapital: null,
    email: "contact@sci-test.fr",
    ...overrides,
  };
}

describe("computeInvoicePreview", () => {
  it("retourne null si le bail est introuvable", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(null);
    const result = await computeInvoicePreview(SOCIETY_ID, PREVIEW_LEASE_ID, "2025-03");
    expect(result).toBeNull();
  });

  it("retourne un aperçu complet avec loyer simple", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(makeLease() as never);
    prismaMock.society.findUnique.mockResolvedValue(makeSociety() as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never); // pas d'impayés
    prismaMock.rentRevision.findFirst.mockResolvedValue(null); // pas de révision
    prismaMock.invoice.findFirst.mockResolvedValue(null); // pas de doublon

    const result = await computeInvoicePreview(SOCIETY_ID, PREVIEW_LEASE_ID, "2025-03");
    expect(result).not.toBeNull();
    expect(result?.lines).toHaveLength(1);
    expect(result?.lines[0].label).toContain("Loyer");
    expect(result?.lines[0].totalHT).toBe(800);
    expect(result?.totalHT).toBe(800);
    expect(result?.previousBalance).toBe(0);
    expect(result?.alreadyExists).toBe(false);
  });

  it("calcule le solde précédent depuis les factures impayées", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(makeLease() as never);
    prismaMock.society.findUnique.mockResolvedValue(makeSociety() as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { totalTTC: 1000, payments: [{ amount: 400 }] }, // solde = 600
    ] as never);
    prismaMock.rentRevision.findFirst.mockResolvedValue(null);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await computeInvoicePreview(SOCIETY_ID, PREVIEW_LEASE_ID, "2025-03");
    expect(result?.previousBalance).toBe(600);
  });

  it("marque alreadyExists=true si une facture existe déjà pour la période", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(makeLease() as never);
    prismaMock.society.findUnique.mockResolvedValue(makeSociety() as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findFirst.mockResolvedValue(null);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: "existing-invoice" } as never);

    const result = await computeInvoicePreview(SOCIETY_ID, PREVIEW_LEASE_ID, "2025-03");
    expect(result?.alreadyExists).toBe(true);
  });

  it("inclut les provisions de charges dans les lignes", async () => {
    prismaMock.lease.findFirst.mockResolvedValue(makeLease({
      chargeProvisions: [{ monthlyAmount: 100, vatRate: 0, label: "Charges locatives" }],
    }) as never);
    prismaMock.society.findUnique.mockResolvedValue(makeSociety() as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findFirst.mockResolvedValue(null);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await computeInvoicePreview(SOCIETY_ID, PREVIEW_LEASE_ID, "2025-03");
    expect(result?.lines).toHaveLength(2);
    expect(result?.lines[1].label).toBe("Charges locatives");
    expect(result?.lines[1].totalHT).toBe(100);
  });
});
