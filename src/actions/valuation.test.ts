import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const {
  revalidatePath,
  checkSubscriptionActive,
  searchDvfTransactions,
  collectBuildingData,
  callClaude,
  callOpenAI,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkSubscriptionActive: vi.fn(),
  searchDvfTransactions: vi.fn(),
  collectBuildingData: vi.fn(),
  callClaude: vi.fn(),
  callOpenAI: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/plan-limits", () => ({ checkSubscriptionActive }));
vi.mock("@/lib/valuation/dvf-service", () => ({ searchDvfTransactions }));
vi.mock("@/lib/valuation/data-collector", () => ({ collectBuildingData }));
vi.mock("@/lib/valuation/ai-service", () => ({
  callClaude,
  callOpenAI,
  extractReportData: vi.fn(),
}));

import {
  batchCreatePropertyValuations,
  createValuation,
  deleteValuation,
  getValuation,
  getValuations,
  rerunAllValuations,
  runAiAnalysis,
  searchComparables,
  updateValuationResults,
} from "./valuation";

const SOCIETY_ID = "society-1";
const BUILDING_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALUATION_ID = "clh3x2z4k0001qh8g7z1y2v3u";

function makeAiValuationResult(mid: number) {
  return {
    summary: {
      estimatedValueLow: mid - 20000,
      estimatedValueMid: mid,
      estimatedValueHigh: mid + 20000,
      rentalValue: 36000,
      pricePerSqm: 4200,
      capitalizationRate: 5.2,
      confidence: 82,
    },
    methodology: {
      comparisonMethod: {
        applied: true,
        pricePerSqm: 4200,
        adjustments: "RAS",
        resultValue: mid,
        reasoning: "Comparables proches",
      },
      incomeMethod: {
        applied: true,
        grossRentalIncome: 42000,
        netRentalIncome: 36000,
        capRate: 5.2,
        resultValue: mid,
        reasoning: "Capitalisation cohérente",
      },
      costMethod: {
        applied: false,
        landValue: null,
        constructionCost: null,
        depreciationRate: null,
        resultValue: null,
        reasoning: "Non pertinent",
      },
    },
    swot: {
      strengths: ["Adresse"],
      weaknesses: ["Travaux"],
      opportunities: ["Revalorisation"],
      threats: ["Vacance"],
    },
    comparablesAnalysis: {
      summary: "Comparables suffisants",
      adjustedComparables: [],
    },
    marketContext: "Marché stable",
    recommendations: ["Conserver"],
    caveats: ["Hypothèses usuelles"],
    detailedNarrative: "Analyse synthétique",
  };
}

describe("valuation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
  });

  it("refuse la création si l'utilisateur n'est pas authentifié", async () => {
    mockUnauthenticated();

    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });

    expect(result).toEqual({
      success: false,
      error: "Non authentifié",
    });
  });

  it("refuse la création si l'abonnement est inactif", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    checkSubscriptionActive.mockResolvedValue({
      active: false,
      message: "Abonnement inactif",
    });

    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });

    expect(result).toEqual({
      success: false,
      error: "Abonnement inactif",
    });
    expect(prismaMock.building.findFirst).not.toHaveBeenCalled();
  });

  it("retourne une erreur si l'immeuble est introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue(null);

    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });

    expect(result).toEqual({
      success: false,
      error: "Immeuble introuvable",
    });
  });

  it("crée une évaluation et journalise l'action quand toutes les conditions sont réunies", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({
      id: BUILDING_ID,
      name: "Immeuble Atlas",
    } as never);
    prismaMock.propertyValuation.count.mockResolvedValue(0);
    prismaMock.propertyValuation.create.mockResolvedValue({
      id: VALUATION_ID,
    } as never);

    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });

    expect(result).toEqual({
      success: true,
      data: { id: VALUATION_ID },
    });
    expect(prismaMock.propertyValuation.create).toHaveBeenCalledWith({
      data: {
        buildingId: BUILDING_ID,
        societyId: SOCIETY_ID,
        createdBy: "user-1",
        status: "DRAFT",
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "CREATE",
      entity: "PropertyValuation",
      entityId: VALUATION_ID,
      details: { buildingId: BUILDING_ID, buildingName: "Immeuble Atlas" },
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/patrimoine/immeubles/${BUILDING_ID}/valorisation`);
  });

  it("retourne des lectures silencieuses si l'utilisateur n'a pas accès à la société", async () => {
    mockUnauthenticated();

    const valuation = await getValuation(SOCIETY_ID, VALUATION_ID);
    const valuations = await getValuations(SOCIETY_ID, BUILDING_ID);

    expect(valuation).toBeNull();
    expect(valuations).toEqual([]);
  });

  it("met à jour les résultats d'évaluation et synchronise la valeur vénale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
    } as never);

    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, {
      estimatedValueMid: 450000,
      estimatedValueLow: 420000,
      capitalizationRate: 5.1,
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.propertyValuation.update).toHaveBeenCalledWith({
      where: { id: VALUATION_ID },
      data: {
        estimatedValueMid: 450000,
        estimatedValueLow: 420000,
        capitalizationRate: 5.1,
      },
    });
    expect(prismaMock.building.update).toHaveBeenCalledWith({
      where: { id: BUILDING_ID },
      data: { marketValue: 450000 },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "UPDATE",
      entity: "PropertyValuation",
      entityId: VALUATION_ID,
      details: { updatedFields: ["estimatedValueLow", "estimatedValueMid", "capitalizationRate"] },
    });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, `/patrimoine/immeubles/${BUILDING_ID}/valorisation`);
    expect(revalidatePath).toHaveBeenNthCalledWith(2, `/patrimoine/immeubles/${BUILDING_ID}`);
    expect(revalidatePath).toHaveBeenNthCalledWith(3, "/dashboard");
  });

  it("recherche des comparables DVF, remplace les anciens et trace l'audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
      building: {
        postalCode: "69001",
        city: "Lyon",
        latitude: 45.76,
        longitude: 4.84,
      },
    } as never);
    searchDvfTransactions.mockResolvedValue([
      {
        id: "dvf-1",
        address: "1 rue de la Paix",
        city: "Lyon",
        postalCode: "69001",
        saleDate: "2025-01-15",
        salePrice: 320000,
        builtArea: 80,
        landArea: null,
        pricePerSqm: 4000,
        propertyType: "APPARTEMENT",
        distanceKm: 0.8,
      },
    ]);

    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, {
      radiusKm: 5,
      periodYears: 3,
      propertyTypes: ["APPARTEMENT"],
    });

    expect(result).toEqual({
      success: true,
      data: { count: 1 },
    });
    expect(prismaMock.comparableSale.deleteMany).toHaveBeenCalledWith({
      where: { valuationId: VALUATION_ID, source: "DVF" },
    });
    expect(prismaMock.comparableSale.createMany).toHaveBeenCalledWith({
      data: [
        {
          valuationId: VALUATION_ID,
          source: "DVF",
          sourceReference: "dvf-1",
          address: "1 rue de la Paix",
          city: "Lyon",
          postalCode: "69001",
          saleDate: new Date("2025-01-15"),
          salePrice: 320000,
          builtArea: 80,
          landArea: null,
          pricePerSqm: 4000,
          propertyType: "APPARTEMENT",
          distanceKm: 0.8,
        },
      ],
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "CREATE",
      entity: "ComparableSale",
      entityId: VALUATION_ID,
      details: { count: 1, radiusKm: 5 },
    });
  });

  it("lance les analyses IA, agrège les résultats et met à jour l'immeuble", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
    } as never);
    prismaMock.building.findFirst.mockResolvedValue({
      postalCode: "69001",
      city: "Lyon",
      latitude: 45.76,
      longitude: 4.84,
    } as never);
    searchDvfTransactions.mockResolvedValue([
      {
        id: "dvf-1",
        address: "1 rue de la Paix",
        city: "Lyon",
        postalCode: "69001",
        saleDate: "2025-01-15",
        salePrice: 320000,
        builtArea: 80,
        landArea: null,
        pricePerSqm: 4000,
        propertyType: "APPARTEMENT",
        distanceKm: 0.8,
      },
    ]);
    collectBuildingData.mockResolvedValue({ building: { name: "Atlas" } });
    callClaude.mockResolvedValue({
      result: makeAiValuationResult(460000),
      rawResponse: "{\"provider\":\"claude\"}",
      durationMs: 1200,
      tokenCount: 900,
    });
    callOpenAI.mockResolvedValue({
      result: makeAiValuationResult(440000),
      rawResponse: "{\"provider\":\"openai\"}",
      durationMs: 900,
      tokenCount: 700,
    });
    prismaMock.aiValuationAnalysis.findMany.mockResolvedValue([
      {
        estimatedValue: 460000,
        rentalValue: 36000,
        pricePerSqm: 4200,
        capRate: 5.2,
      },
      {
        estimatedValue: 440000,
        rentalValue: 36000,
        pricePerSqm: 4200,
        capRate: 5.2,
      },
    ] as never);

    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, {
      providers: ["CLAUDE", "OPENAI"],
    });

    expect(result).toEqual({
      success: true,
      data: { analysisCount: 2 },
    });
    expect(prismaMock.propertyValuation.update).toHaveBeenNthCalledWith(1, {
      where: { id: VALUATION_ID },
      data: { status: "IN_PROGRESS" },
    });
    expect(prismaMock.propertyValuation.update).toHaveBeenNthCalledWith(2, {
      where: { id: VALUATION_ID },
      data: {
        status: "COMPLETED",
        estimatedValueLow: 440000,
        estimatedValueMid: 450000,
        estimatedValueHigh: 460000,
        estimatedRentalValue: 36000,
        pricePerSqm: 4200,
        capitalizationRate: 5.2,
      },
    });
    expect(prismaMock.aiValuationAnalysis.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.building.update).toHaveBeenCalledWith({
      where: { id: BUILDING_ID },
      data: { marketValue: 450000 },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "CREATE",
      entity: "AiValuationAnalysis",
      entityId: VALUATION_ID,
      details: { providers: ["CLAUDE", "OPENAI"], analysisCount: 2 },
    });
  });

  it("relance toutes les évaluations pour un super admin et agrège les nouvelles valeurs", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never);
    prismaMock.building.findMany.mockResolvedValue([
      { id: BUILDING_ID, societyId: SOCIETY_ID, name: "Immeuble Atlas" },
    ] as never);
    prismaMock.propertyValuation.create.mockResolvedValue({
      id: VALUATION_ID,
    } as never);
    prismaMock.building.findFirst.mockResolvedValue({
      city: "Lyon",
      postalCode: "69001",
      buildingType: "IMMEUBLE",
    } as never);
    searchDvfTransactions.mockResolvedValue([
      {
        id: "dvf-1",
        address: "1 rue de la Paix",
        city: "Lyon",
        postalCode: "69001",
        saleDate: "2025-01-15",
        salePrice: 320000,
        builtArea: 80,
        landArea: null,
        pricePerSqm: 4000,
        propertyType: "APPARTEMENT",
        latitude: null,
        longitude: null,
        distanceKm: 0.8,
      },
    ]);
    collectBuildingData.mockResolvedValue({ building: { name: "Atlas" } });
    callClaude.mockResolvedValue({
      result: makeAiValuationResult(470000),
      rawResponse: "{\"provider\":\"claude\"}",
      durationMs: 1100,
      tokenCount: 850,
    });
    callOpenAI.mockResolvedValue({
      result: makeAiValuationResult(430000),
      rawResponse: "{\"provider\":\"openai\"}",
      durationMs: 950,
      tokenCount: 740,
    });

    const result = await rerunAllValuations();

    expect(result).toEqual({
      success: true,
      data: { created: 1, errors: [] },
    });
    expect(prismaMock.propertyValuation.deleteMany).toHaveBeenCalledWith({
      where: { societyId: { in: [SOCIETY_ID] } },
    });
    expect(prismaMock.building.updateMany).toHaveBeenCalledWith({
      where: { societyId: { in: [SOCIETY_ID] } },
      data: { marketValue: null },
    });
    expect(prismaMock.comparableSale.createMany).toHaveBeenCalledWith({
      data: [
        {
          valuationId: VALUATION_ID,
          id: "dvf-1",
          address: "1 rue de la Paix",
          city: "Lyon",
          postalCode: "69001",
          saleDate: "2025-01-15",
          salePrice: 320000,
          builtArea: 80,
          landArea: null,
          pricePerSqm: 4000,
          propertyType: "APPARTEMENT",
          latitude: null,
          longitude: null,
          distanceKm: 0.8,
          source: "DVF",
        },
      ],
    });
    expect(prismaMock.propertyValuation.update).toHaveBeenCalledWith({
      where: { id: VALUATION_ID },
      data: {
        status: "COMPLETED",
        estimatedValueLow: 430000,
        estimatedValueMid: 450000,
        estimatedValueHigh: 470000,
        estimatedRentalValue: 36000,
        pricePerSqm: 4200,
        capitalizationRate: 5.2,
      },
    });
    expect(prismaMock.building.update).toHaveBeenCalledWith({
      where: { id: BUILDING_ID },
      data: { marketValue: 450000 },
    });
  });

  it("passe le statut à DRAFT si aucune analyse IA ne réussit (rerunAllValuations)", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never) // requireSuperAdmin
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never); // getMyManagedSocieties
    prismaMock.building.findMany.mockResolvedValue([
      { id: BUILDING_ID, societyId: SOCIETY_ID, name: "Bâtiment A" },
    ] as never);
    prismaMock.propertyValuation.create.mockResolvedValue({ id: VALUATION_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null); // DVF lookup → null → pas de DVF
    collectBuildingData.mockResolvedValue({ city: "Lyon" });
    callClaude.mockRejectedValue(new Error("Claude KO"));
    callOpenAI.mockRejectedValue(new Error("OpenAI KO"));
    prismaMock.propertyValuation.update.mockResolvedValue({} as never);

    const result = await rerunAllValuations();

    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
    expect(prismaMock.propertyValuation.update).toHaveBeenCalledWith({
      where: { id: VALUATION_ID },
      data: { status: "DRAFT" },
    });
  });

  it("supprime une évaluation existante pour un admin de société", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
    } as never);

    const result = await deleteValuation(SOCIETY_ID, VALUATION_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.propertyValuation.delete).toHaveBeenCalledWith({
      where: { id: VALUATION_ID },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "DELETE",
      entity: "PropertyValuation",
      entityId: VALUATION_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/patrimoine/immeubles/${BUILDING_ID}/valorisation`);
  });
});

// ── batchCreatePropertyValuations ─────────────────────────────────

describe("batchCreatePropertyValuations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
  });

  it("retourne une erreur si aucun immeuble sélectionné", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const r = await batchCreatePropertyValuations(SOCIETY_ID, []);
    expect(r).toEqual({ success: false, error: "Aucun immeuble sélectionné" });
  });

  it("retourne une erreur si plus de 20 immeubles", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const ids = Array.from({ length: 21 }, (_, i) => `bld-${i}`);
    const r = await batchCreatePropertyValuations(SOCIETY_ID, ids);
    expect(r).toEqual({ success: false, error: "Maximum 20 immeubles à la fois" });
  });

  it("ignore un immeuble déjà évalué 2 fois cette année (skipped)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID, societyId: SOCIETY_ID } as never);
    prismaMock.propertyValuation.count.mockResolvedValue(2); // déjà 2 évaluations

    const r = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(r.success).toBe(true);
    expect(r.data?.skipped).toBe(1);
    expect(r.data?.created).toBe(0);
  });

  it("crée une évaluation pour un immeuble non encore évalué", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID, societyId: SOCIETY_ID } as never);
    prismaMock.propertyValuation.count.mockResolvedValue(0);
    prismaMock.propertyValuation.create.mockResolvedValue({ id: VALUATION_ID } as never);
    // runAiAnalysis is called internally; mock its Prisma calls
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    collectBuildingData.mockResolvedValue({ city: "Lyon" });
    callClaude.mockRejectedValue(new Error("no key"));
    callOpenAI.mockRejectedValue(new Error("no key"));
    prismaMock.propertyValuation.update.mockResolvedValue({} as never);

    const r = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(r.success).toBe(true);
    expect(r.data?.created).toBe(1);
    expect(r.data?.skipped).toBe(0);
  });
});
