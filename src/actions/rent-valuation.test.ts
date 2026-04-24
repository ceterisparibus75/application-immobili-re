import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/valuation/data-collector", () => ({
  collectLeaseData: vi.fn().mockResolvedValue({ leaseId: "lease-1", area: 50 }),
}));
vi.mock("@/lib/valuation/dvf-service", () => ({
  searchDvfTransactions: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/valuation/ai-service", () => ({
  callClaudeRentValuation: vi.fn().mockResolvedValue({
    result: {
      summary: { estimatedMarketRent: 10000, rentPerSqm: 200, confidence: 0.85 },
      methodology: { comparisonMethod: { applied: true }, incomeMethod: { applied: false } },
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    },
    rawResponse: "{}",
    durationMs: 500,
    tokenCount: 100,
  }),
  callOpenAIRentValuation: vi.fn().mockResolvedValue({
    result: {
      summary: { estimatedMarketRent: 9500, rentPerSqm: 190, confidence: 0.8 },
      methodology: { comparisonMethod: { applied: false }, incomeMethod: { applied: true } },
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    },
    rawResponse: "{}",
    durationMs: 400,
    tokenCount: 80,
  }),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  createRentValuation,
  getRentValuation,
  getRentValuations,
  deleteRentValuation,
  batchCreateRentValuations,
  searchComparableRents,
} from "./rent-valuation";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const LEASE_ID = "clh3x2z4k0001qh8g7z1y2v3t";
const VALUATION_ID = "clh3x2z4k0002qh8g7z1y2v3t";

function makeValuation(overrides = {}) {
  return {
    id: VALUATION_ID,
    societyId: SOCIETY_ID,
    leaseId: LEASE_ID,
    status: "DRAFT",
    currentRent: 9600,
    ...overrides,
  };
}

function makeLease(overrides = {}) {
  return {
    id: LEASE_ID,
    societyId: SOCIETY_ID,
    currentRentHT: 800,
    paymentFrequency: "MENSUEL",
    ...overrides,
  };
}

// ── createRentValuation ────────────────────────────────────────

describe("createRentValuation", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createRentValuation(SOCIETY_ID, { leaseId: LEASE_ID });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si abonnement inactif", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    // L'abonnement par défaut est ACTIVE grâce à mockAuthSession,
    // mais on peut le forcer inactif via prismaMock
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    // checkSubscriptionActive retourne false si pas d'abonnement trouvé
    const result = await createRentValuation(SOCIETY_ID, { leaseId: LEASE_ID });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si bail introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await createRentValuation(SOCIETY_ID, { leaseId: LEASE_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("crée l'évaluation de loyer avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(makeLease() as never);
    prismaMock.rentValuation.create.mockResolvedValue(makeValuation() as never);

    const result = await createRentValuation(SOCIETY_ID, { leaseId: LEASE_ID });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(VALUATION_ID);
    expect(prismaMock.rentValuation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaseId: LEASE_ID,
          societyId: SOCIETY_ID,
          status: "DRAFT",
          currentRent: 9600, // 800 × 12
        }),
      })
    );
  });
});

// ── getRentValuation ───────────────────────────────────────────

describe("getRentValuation", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getRentValuation(SOCIETY_ID, VALUATION_ID);
    expect(result).toBeNull();
  });

  it("retourne l'évaluation si authentifié", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never);

    const result = await getRentValuation(SOCIETY_ID, VALUATION_ID);
    expect(result).toMatchObject({ id: VALUATION_ID });
  });
});

// ── getRentValuations ──────────────────────────────────────────

describe("getRentValuations", () => {
  it("retourne [] si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getRentValuations(SOCIETY_ID, LEASE_ID);
    expect(result).toEqual([]);
  });

  it("retourne la liste des évaluations si authentifié", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.rentValuation.findMany.mockResolvedValue([makeValuation()] as never);

    const result = await getRentValuations(SOCIETY_ID, LEASE_ID);
    expect(result).toHaveLength(1);
  });
});

// ── deleteRentValuation ────────────────────────────────────────

describe("deleteRentValuation", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteRentValuation(SOCIETY_ID, VALUATION_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si évaluation introuvable", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(null);

    const result = await deleteRentValuation(SOCIETY_ID, VALUATION_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("supprime l'évaluation avec succès", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never);
    prismaMock.rentValuation.delete.mockResolvedValue({} as never);

    const result = await deleteRentValuation(SOCIETY_ID, VALUATION_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.rentValuation.delete).toHaveBeenCalledWith({ where: { id: VALUATION_ID } });
  });
});

// ── batchCreateRentValuations ──────────────────────────────────

describe("batchCreateRentValuations", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await batchCreateRentValuations(SOCIETY_ID, [LEASE_ID]);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si aucun bail sélectionné", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await batchCreateRentValuations(SOCIETY_ID, []);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Aucun bail/);
  });

  it("retourne une erreur si plus de 20 baux", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await batchCreateRentValuations(SOCIETY_ID, Array(21).fill(LEASE_ID));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Maximum 20/);
  });
});

// ── searchComparableRents ──────────────────────────────────────

describe("searchComparableRents", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await searchComparableRents(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 5,
      periodYears: 2,
      propertyTypes: ["Appartement"],
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si évaluation introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(null);

    const result = await searchComparableRents(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 5,
      periodYears: 2,
      propertyTypes: ["Appartement"],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne 0 comparable si DVF vide", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue({
      ...makeValuation(),
      lease: {
        lot: {
          building: { latitude: 48.85, longitude: 2.35, city: "Paris", postalCode: "75001" },
        },
      },
    } as never);
    prismaMock.comparableRent.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.comparableRent.createMany.mockResolvedValue({ count: 0 } as never);

    const result = await searchComparableRents(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 5,
      periodYears: 2,
      propertyTypes: ["Appartement"],
    });
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(0);
  });
});
