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
import { revalidatePath } from "next/cache";
import {
  createRentValuation,
  runRentAiAnalysis,
  getRentValuation,
  getRentValuations,
  deleteRentValuation,
  batchCreateRentValuations,
  searchComparableRents,
} from "./rent-valuation";
import { callClaudeRentValuation, callOpenAIRentValuation } from "@/lib/valuation/ai-service";
import { searchDvfTransactions } from "@/lib/valuation/dvf-service";

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

  it("retourne une erreur Zod si radiusKm est invalide (ligne 225)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await searchComparableRents(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 0, // below minimum of 0.5
      periodYears: 2,
      propertyTypes: ["Appartement"],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Rayon minimum");
  });

  it("insère des comparables DVF quand des transactions sont disponibles (lignes 267-268)", async () => {
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
    prismaMock.comparableRent.createMany.mockResolvedValue({ count: 1 } as never);
    vi.mocked(searchDvfTransactions).mockResolvedValueOnce([
      {
        id: "dvf-1",
        address: "1 rue de Rivoli",
        city: "Paris",
        postalCode: "75001",
        saleDate: "2025-01-15",
        salePrice: 200000,
        builtArea: 50,
        propertyType: "Appartement",
        distanceKm: 0.5,
      },
    ] as never);

    const result = await searchComparableRents(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 5,
      periodYears: 2,
      propertyTypes: ["Appartement"],
    });
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(1);
    expect(prismaMock.comparableRent.createMany).toHaveBeenCalled();
  });

  it("retourne une erreur générique si la BDD échoue (lignes 300-302)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await searchComparableRents(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 5,
      periodYears: 2,
      propertyTypes: ["Appartement"],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("comparables");
  });
});

// ── createRentValuation — branches manquantes ──────────────────

describe("createRentValuation — branches manquantes", () => {
  it("retourne une erreur Zod si leaseId est invalide (ligne 43)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await createRentValuation(SOCIETY_ID, { leaseId: "not-a-cuid" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Identifiant de bail invalide");
  });

  it("retourne une erreur générique si la BDD échoue (lignes 79-81)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await createRentValuation(SOCIETY_ID, { leaseId: LEASE_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain("création");
  });
});

// ── deleteRentValuation — branches manquantes ──────────────────

describe("deleteRentValuation — branches manquantes", () => {
  it("retourne une erreur générique si la BDD échoue (lignes 375-377)", async () => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await deleteRentValuation(SOCIETY_ID, VALUATION_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("suppression");
  });
});

// ── runRentAiAnalysis ──────────────────────────────────────────

describe("runRentAiAnalysis", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur Zod si providers est vide (ligne 98-100)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: [] });
    expect(result.success).toBe(false);
    expect(result.error).toContain("fournisseur IA");
  });

  it("retourne une erreur si l'évaluation est introuvable (ligne 105)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(null);
    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("lance CLAUDE et OPENAI en parallèle et met à jour l'évaluation (lignes 118-192)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never);
    prismaMock.rentValuation.update.mockResolvedValue({} as never);
    prismaMock.rentAiAnalysis.create.mockResolvedValue({ id: "a1" } as never);
    prismaMock.rentAiAnalysis.findMany.mockResolvedValue([
      { estimatedRent: 10000, rentPerSqm: 200 },
      { estimatedRent: 9500, rentPerSqm: 190 },
    ] as never);

    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE", "OPENAI"] });
    expect(result.success).toBe(true);
    expect(result.data?.analysisCount).toBe(2);
    expect(prismaMock.rentAiAnalysis.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.rentValuation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("consigne l'erreur d'un fournisseur qui échoue et continue (ligne 161)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never);
    prismaMock.rentValuation.update.mockResolvedValue({} as never);
    vi.mocked(callClaudeRentValuation).mockRejectedValueOnce(new Error("Claude API unavailable"));
    prismaMock.rentAiAnalysis.create.mockResolvedValue({ id: "a2" } as never);
    prismaMock.rentAiAnalysis.findMany.mockResolvedValue([
      { estimatedRent: 9500, rentPerSqm: 190 },
    ] as never);

    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE", "OPENAI"] });
    expect(result.success).toBe(true);
    expect(result.data?.analysisCount).toBe(1); // only OPENAI succeeded
  });

  it("ne met pas à jour l'évaluation si aucune analyse n'a réussi (ligne 166)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never);
    prismaMock.rentValuation.update.mockResolvedValue({} as never); // IN_PROGRESS only
    vi.mocked(callClaudeRentValuation).mockRejectedValueOnce(new Error("Claude failed"));
    vi.mocked(callOpenAIRentValuation).mockRejectedValueOnce(new Error("OpenAI failed"));

    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE", "OPENAI"] });
    expect(result.success).toBe(true);
    expect(result.data?.analysisCount).toBe(0);
    // update was called only once (IN_PROGRESS), not for COMPLETED
    expect(prismaMock.rentValuation.update).toHaveBeenCalledTimes(1);
  });

  it("retourne null depuis average si tous les rentPerSqm sont null (ligne 446)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never);
    prismaMock.rentValuation.update.mockResolvedValue({} as never);
    prismaMock.rentAiAnalysis.create.mockResolvedValue({ id: "a1" } as never);
    prismaMock.rentAiAnalysis.findMany.mockResolvedValue([
      { estimatedRent: 10000, rentPerSqm: null },
    ] as never);

    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(true);
    // rentPerSqm will be null since average([null]) returns null
    expect(prismaMock.rentValuation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rentPerSqm: null }) })
    );
  });

  it("retourne une erreur générique si la BDD échoue (lignes 204-207)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.rentValuation.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await runRentAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(false);
    expect(result.error).toContain("IA des loyers");
  });
});

// ── batchCreateRentValuations — branches manquantes ───────────

describe("batchCreateRentValuations — branches manquantes", () => {
  it("ajoute une erreur pour les baux introuvables et continue (ligne 405)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(null); // all leases not found
    const result = await batchCreateRentValuations(SOCIETY_ID, [LEASE_ID]);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(0);
    expect(result.data?.errors).toHaveLength(1);
  });

  it("capture les erreurs de la boucle interne (lignes 423-424)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await batchCreateRentValuations(SOCIETY_ID, [LEASE_ID]);
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
  });

  it("crée les évaluations et lance les analyses IA en lot (lignes 398-430)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(makeLease() as never);
    prismaMock.rentValuation.create.mockResolvedValue(makeValuation() as never);
    prismaMock.rentValuation.findFirst.mockResolvedValue(makeValuation() as never); // for runRentAiAnalysis
    prismaMock.rentValuation.update.mockResolvedValue({} as never);
    prismaMock.rentAiAnalysis.create.mockResolvedValue({ id: "a1" } as never);
    prismaMock.rentAiAnalysis.findMany.mockResolvedValue([
      { estimatedRent: 10000, rentPerSqm: 200 },
      { estimatedRent: 9500, rentPerSqm: 190 },
    ] as never);

    const result = await batchCreateRentValuations(SOCIETY_ID, [LEASE_ID]);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
    expect(result.data?.errors).toHaveLength(0);
  });

  it("retourne une erreur générique si revalidatePath échoue au niveau global (lignes 434-435)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(null); // no lease found → errors, created=0
    vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("revalidate error"); });
    const result = await batchCreateRentValuations(SOCIETY_ID, [LEASE_ID]);
    expect(result.success).toBe(false);
    expect(result.error).toContain("lot");
  });
});
