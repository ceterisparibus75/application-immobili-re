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
  extractReportData,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkSubscriptionActive: vi.fn(),
  searchDvfTransactions: vi.fn(),
  collectBuildingData: vi.fn(),
  callClaude: vi.fn(),
  callOpenAI: vi.fn(),
  extractReportData: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/plan-limits", () => ({ checkSubscriptionActive }));
vi.mock("@/lib/valuation/dvf-service", () => ({ searchDvfTransactions }));
vi.mock("@/lib/valuation/data-collector", () => ({ collectBuildingData }));
vi.mock("@/lib/valuation/ai-service", () => ({
  callClaude,
  callOpenAI,
  extractReportData,
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
  uploadExpertReport,
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

// ── uploadExpertReport ────────────────────────────────────────────────────────

describe("uploadExpertReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
  });

  function makeFormData(hasFile = true): FormData {
    const mockFile = hasFile
      ? { name: "rapport-expert.pdf", arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }
      : null;
    const fields: Record<string, unknown> = {
      file: mockFile,
      expertName: "Expert SA",
      reportDate: "2026-04-20",
      reportReference: null,
    };
    return { get: (key: string) => fields[key] ?? null } as unknown as FormData;
  }

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, makeFormData(false));
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si aucun fichier fourni", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, makeFormData(false));
    expect(result).toEqual({ success: false, error: "Aucun fichier fourni" });
  });

  it("retourne une erreur si l'évaluation est introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue(null);

    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, makeFormData());
    expect(result).toEqual({ success: false, error: "Évaluation introuvable" });
  });

  it("crée le rapport expert et met à jour la valeur vénale si l'IA extrait une estimation", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
    } as never);
    extractReportData.mockResolvedValue({
      result: {
        valuation: { estimatedValue: 450000, rentalValue: 36000, pricePerSqm: 4500, capRate: 5.0, methodsUsed: ["Comparison"] },
        property: { totalArea: 100 },
      },
    });
    prismaMock.expertReport.create.mockResolvedValue({ id: "report-1" } as never);

    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, makeFormData());
    expect(result).toEqual({ success: true, data: { id: "report-1" } });
    expect(prismaMock.expertReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expertName: "Expert SA", estimatedValue: 450000 }),
      })
    );
    expect(prismaMock.building.update).toHaveBeenCalledWith({
      where: { id: BUILDING_ID },
      data: { marketValue: 450000 },
    });
  });

  it("crée le rapport même si l'extraction IA échoue (fallback gracieux)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
    } as never);
    extractReportData.mockRejectedValue(new Error("IA indisponible"));
    prismaMock.expertReport.create.mockResolvedValue({ id: "report-2" } as never);

    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, makeFormData());
    expect(result).toEqual({ success: true, data: { id: "report-2" } });
    expect(prismaMock.expertReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimatedValue: null }),
      })
    );
  });
});

// ── rerunAllValuations — catch block ──────────────────────────────────────────

describe("rerunAllValuations — erreurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur ForbiddenError si l'utilisateur n'est pas SUPER_ADMIN", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    // findMany retourne un membership sans SUPER_ADMIN → requireSuperAdmin lève ForbiddenError
    prismaMock.userSociety.findMany.mockResolvedValue([
      { userId: "user-1", societyId: SOCIETY_ID, role: "GESTIONNAIRE" },
    ] as never);

    const result = await rerunAllValuations();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/super|accès/i);
  });
});

// ── createValuation — branches manquantes ────────────────────────────────────

describe("createValuation — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
  });

  it("retourne une erreur Zod si buildingId n'est pas un CUID valide (ligne 47)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await createValuation(SOCIETY_ID, { buildingId: "not-a-cuid" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("invalide");
  });

  it("refuse si le quota de 2 évaluations par an est atteint (ligne 66)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID, name: "Atlas" } as never);
    prismaMock.propertyValuation.count.mockResolvedValue(2);
    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });
    expect(result).toEqual({ success: false, error: "Limite atteinte : 2 avis de valeur maximum par an et par immeuble" });
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (ligne 91)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques lors de la création (lignes 92-93)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID, name: "Atlas" } as never);
    prismaMock.propertyValuation.count.mockResolvedValue(0);
    prismaMock.propertyValuation.create.mockRejectedValue(new Error("DB crash"));
    const result = await createValuation(SOCIETY_ID, { buildingId: BUILDING_ID });
    expect(result).toEqual({ success: false, error: "Erreur lors de la création de l'évaluation" });
  });
});

// ── runAiAnalysis — branches manquantes ──────────────────────────────────────

describe("runAiAnalysis — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur Zod si providers est vide (ligne 111)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: [] as never });
    expect(result.success).toBe(false);
    expect(result.error).toContain("fournisseur");
  });

  it("continue si le rafraîchissement DVF échoue — non bloquant (ligne 165)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue({ postalCode: "69001", city: "Lyon", latitude: null, longitude: null } as never);
    searchDvfTransactions.mockRejectedValue(new Error("DVF unavailable"));
    collectBuildingData.mockResolvedValue({ building: { name: "Atlas" } });
    callClaude.mockRejectedValue(new Error("no key"));
    callOpenAI.mockRejectedValue(new Error("no key"));
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE", "OPENAI"] });
    expect(result.success).toBe(true);
    expect(result.data?.analysisCount).toBe(0);
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (lignes 280-281)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques (lignes 282-283)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result).toEqual({ success: false, error: "Erreur lors de l'analyse IA" });
  });
});

// ── uploadExpertReport — branches manquantes ──────────────────────────────────

describe("uploadExpertReport — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function fd(expertName: string): FormData {
    return {
      get: (key: string) =>
        ({
          file: { name: "r.pdf", size: 100, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) },
          expertName,
          reportDate: "2026-04-20",
          reportReference: null,
        } as Record<string, unknown>)[key] ?? null,
    } as unknown as FormData;
  }

  it("retourne une erreur Zod si expertName est trop court (ligne 308)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, fd("A"));
    expect(result.success).toBe(false);
    expect(result.error).toContain("expert");
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (ligne 385)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, fd("Expert SA"));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques (lignes 386-387)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    extractReportData.mockRejectedValue(new Error("AI crash"));
    prismaMock.expertReport.create.mockRejectedValue(new Error("DB crash"));
    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, fd("Expert SA"));
    expect(result).toEqual({ success: false, error: "Erreur lors de l'import du rapport" });
  });
});

// ── searchComparables — branches manquantes ───────────────────────────────────

describe("searchComparables — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur Zod si radiusKm est inférieur à 0,5 (ligne 405)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, { radiusKm: 0, periodYears: 3 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("km");
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (lignes 463-464)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, { radiusKm: 5, periodYears: 3 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques (lignes 465-466)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, { radiusKm: 5, periodYears: 3 });
    expect(result).toEqual({ success: false, error: "Erreur lors de la recherche de comparables" });
  });
});

// ── updateValuationResults — branches manquantes ──────────────────────────────

describe("updateValuationResults — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur Zod si capitalizationRate dépasse 100 (ligne 484)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, { capitalizationRate: 200 });
    expect(result.success).toBe(false);
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (lignes 519-520)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, { estimatedValueMid: 450000 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques (lignes 521-522)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, { estimatedValueMid: 450000 });
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });
});

// ── getValuation / getValuations — succès ────────────────────────────────────

describe("getValuation / getValuations — succès", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne l'évaluation si l'utilisateur a accès (ligne 589)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
      aiAnalyses: [],
      expertReports: [],
      comparableSales: [],
    } as never);
    const result = await getValuation(SOCIETY_ID, VALUATION_ID);
    expect(result).toBeTruthy();
    expect(prismaMock.propertyValuation.findFirst).toHaveBeenCalled();
  });

  it("retourne la liste des évaluations si l'utilisateur a accès (ligne 604)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.propertyValuation.findMany.mockResolvedValue([
      { id: VALUATION_ID, buildingId: BUILDING_ID },
    ] as never);
    const result = await getValuations(SOCIETY_ID, BUILDING_ID);
    expect(result).toHaveLength(1);
    expect(prismaMock.propertyValuation.findMany).toHaveBeenCalled();
  });
});

// ── deleteValuation — branches manquantes ─────────────────────────────────────

describe("deleteValuation — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (ligne 643)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await deleteValuation(SOCIETY_ID, VALUATION_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques (lignes 644-645)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await deleteValuation(SOCIETY_ID, VALUATION_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });
});

// ── batchCreatePropertyValuations — branches manquantes ──────────────────────

describe("batchCreatePropertyValuations — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
  });

  it("ajoute une erreur si un immeuble lève une exception dans la boucle (lignes 566-567)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID, societyId: SOCIETY_ID } as never);
    prismaMock.propertyValuation.count.mockRejectedValue(new Error("count crash"));
    const r = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(r.success).toBe(true);
    expect(r.data?.errors).toHaveLength(1);
    expect(r.data?.created).toBe(0);
  });

  it("renvoie ForbiddenError si le rôle est insuffisant (lignes 575-576)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const r = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/permissions|insuffisant/i);
  });

  it("capture les erreurs génériques de l'outer catch (lignes 577-578)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    checkSubscriptionActive.mockRejectedValue(new Error("subscription crash"));
    const r = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(r).toEqual({ success: false, error: "Erreur lors de l'évaluation en lot" });
  });
});

// ── rerunAllValuations — branches manquantes ──────────────────────────────────

describe("rerunAllValuations — branches manquantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ajoute un message d'erreur si l'analyse d'un immeuble échoue (lignes 814-815)", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never);
    prismaMock.building.findMany.mockResolvedValue([
      { id: BUILDING_ID, societyId: SOCIETY_ID, name: "Immeuble Cassé" },
    ] as never);
    prismaMock.propertyValuation.create.mockRejectedValue(new Error("valuation create crash"));
    const result = await rerunAllValuations();
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toContain("Immeuble Cassé");
  });

  it("capture les erreurs génériques de l'outer catch (lignes 824-825)", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never);
    prismaMock.propertyValuation.deleteMany.mockRejectedValue(new Error("deleteMany crash"));
    const result = await rerunAllValuations();
    expect(result).toEqual({ success: false, error: "Erreur lors de la réévaluation" });
  });
});

// ── runAiAnalysis — branches manquantes (suite) ────────────────────────────────

describe("runAiAnalysis — branches manquantes (suite)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectBuildingData.mockResolvedValue({});
  });

  it("retourne une erreur si l'évaluation est introuvable → B7 arm0 L117", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue(null);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result).toEqual({ success: false, error: "Évaluation introuvable" });
  });

  it("n'effectue pas la recherche DVF si building est null → B8 arm1 L132", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    callClaude.mockRejectedValue(new Error("no key"));
    callOpenAI.mockRejectedValue(new Error("no key"));
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE", "OPENAI"] });
    expect(result.success).toBe(true);
    expect(searchDvfTransactions).not.toHaveBeenCalled();
  });

  it("ne crée pas de comparables DVF si searchDvf retourne zéro → B9 arm1 L145", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue({ postalCode: "69001", city: "Lyon", latitude: null, longitude: null } as never);
    searchDvfTransactions.mockResolvedValue([]);
    callClaude.mockRejectedValue(new Error("no key"));
    callOpenAI.mockRejectedValue(new Error("no key"));
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE", "OPENAI"] });
    expect(result.success).toBe(true);
    expect(prismaMock.comparableSale.createMany).not.toHaveBeenCalled();
  });

  it("n'appelle pas CLAUDE si absent des providers → B10 arm1 L176", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    callOpenAI.mockRejectedValue(new Error("no key"));
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["OPENAI"] });
    expect(result.success).toBe(true);
    expect(callClaude).not.toHaveBeenCalled();
  });

  it("n'appelle pas OPENAI si absent des providers → B11 arm1 L181", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    callClaude.mockRejectedValue(new Error("no key"));
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(true);
    expect(callOpenAI).not.toHaveBeenCalled();
  });

  it("applique les ternaires de méthodologie costMethod=true → B14 arm1, B15 arm1, B16 arm0", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    const resultCostOnly = {
      ...makeAiValuationResult(450000),
      methodology: {
        comparisonMethod: { applied: false, pricePerSqm: null, adjustments: null, resultValue: null, reasoning: "N/A" },
        incomeMethod: { applied: false, grossRentalIncome: null, netRentalIncome: null, capRate: null, resultValue: null, reasoning: "N/A" },
        costMethod: { applied: true, landValue: 200000, constructionCost: 3000000, depreciationRate: 0.1, resultValue: 450000, reasoning: "Coût" },
      },
    };
    callClaude.mockResolvedValueOnce({ result: resultCostOnly, rawResponse: "{}", durationMs: 100, tokenCount: 50 });
    prismaMock.aiValuationAnalysis.findMany.mockResolvedValue([
      { estimatedValue: 450000, rentalValue: 36000, pricePerSqm: 4200, capRate: 5.2 },
    ] as never);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(true);
    expect(prismaMock.aiValuationAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ methodology: "Coût de remplacement" }) })
    );
  });

  it("gère un rejet non-Error du provider IA → B17 arm1 L223", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    callClaude.mockRejectedValueOnce("rate limit" as never);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(true);
    expect(result.data?.analysisCount).toBe(0);
  });

  it("ne met pas à jour la valuation si toutes estimatedValue sont null → B19 arm1 L241", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    callClaude.mockResolvedValueOnce({ result: makeAiValuationResult(450000), rawResponse: "{}", durationMs: 100, tokenCount: 50 });
    prismaMock.aiValuationAnalysis.findMany.mockResolvedValue([
      { estimatedValue: null, rentalValue: null, pricePerSqm: null, capRate: null },
    ] as never);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(true);
    expect(prismaMock.propertyValuation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.propertyValuation.update).toHaveBeenCalledWith({ where: { id: VALUATION_ID }, data: { status: "IN_PROGRESS" } });
  });

  it("retourne une erreur si non authentifié → B20 arm0 L280", async () => {
    mockUnauthenticated();
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(false);
  });

  it("average() retourne null si toutes les valeurs sont nulles → B53 arm0 L655", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    callClaude.mockResolvedValueOnce({ result: makeAiValuationResult(450000), rawResponse: "{}", durationMs: 100, tokenCount: 50 });
    prismaMock.aiValuationAnalysis.findMany.mockResolvedValue([
      { estimatedValue: 450000, rentalValue: null, pricePerSqm: null, capRate: null },
    ] as never);
    const result = await runAiAnalysis(SOCIETY_ID, VALUATION_ID, { providers: ["CLAUDE"] });
    expect(result.success).toBe(true);
    expect(prismaMock.propertyValuation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estimatedRentalValue: null }) })
    );
  });
});

// ── uploadExpertReport — methodsUsed vide ─────────────────────────────────────

describe("uploadExpertReport — methodsUsed vide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("methodology est null si methodsUsed est vide → B26 arm1 L339", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    extractReportData.mockResolvedValue({
      result: {
        valuation: { estimatedValue: 450000, rentalValue: 36000, pricePerSqm: 4500, capRate: 5.0, methodsUsed: [] },
        property: { totalArea: 100 },
      },
    });
    prismaMock.expertReport.create.mockResolvedValue({ id: "report-3" } as never);
    const formData = {
      get: (key: string) =>
        ({
          file: { name: "r.pdf", size: 100, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) },
          expertName: "Expert SA",
          reportDate: "2026-04-20",
          reportReference: null,
        } as Record<string, unknown>)[key] ?? null,
    } as unknown as FormData;
    const result = await uploadExpertReport(SOCIETY_ID, VALUATION_ID, formData);
    expect(result).toEqual({ success: true, data: { id: "report-3" } });
    expect(prismaMock.expertReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ methodology: null }) })
    );
  });
});

// ── searchComparables — branches supplémentaires ──────────────────────────────

describe("searchComparables — branches supplémentaires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si l'évaluation est introuvable → B32 arm0 L412", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue(null);
    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, { radiusKm: 5, periodYears: 3 });
    expect(result).toEqual({ success: false, error: "Évaluation introuvable" });
  });

  it("ne crée pas de comparables si DVF retourne zéro → B33 arm1 L431", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({
      id: VALUATION_ID,
      buildingId: BUILDING_ID,
      building: { postalCode: "69001", city: "Lyon", latitude: null, longitude: null },
    } as never);
    searchDvfTransactions.mockResolvedValue([]);
    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, { radiusKm: 5, periodYears: 3 });
    expect(result).toEqual({ success: true, data: { count: 0 } });
    expect(prismaMock.comparableSale.createMany).not.toHaveBeenCalled();
  });

  it("retourne une erreur si non authentifié → B34 arm0 L463", async () => {
    mockUnauthenticated();
    const result = await searchComparables(SOCIETY_ID, VALUATION_ID, { radiusKm: 5, periodYears: 3 });
    expect(result.success).toBe(false);
  });
});

// ── updateValuationResults — branches supplémentaires ─────────────────────────

describe("updateValuationResults — branches supplémentaires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si l'évaluation est introuvable → B37 arm0 L490", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue(null);
    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, { estimatedValueMid: 450000 });
    expect(result).toEqual({ success: false, error: "Évaluation introuvable" });
  });

  it("ne met pas à jour building.marketValue si estimatedValueMid absent → B38 arm1 L498", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue({ id: VALUATION_ID, buildingId: BUILDING_ID } as never);
    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, { estimatedValueLow: 420000 });
    expect(result).toEqual({ success: true });
    expect(prismaMock.building.update).not.toHaveBeenCalled();
  });

  it("retourne une erreur si non authentifié → B39 arm0 L519", async () => {
    mockUnauthenticated();
    const result = await updateValuationResults(SOCIETY_ID, VALUATION_ID, { estimatedValueMid: 450000 });
    expect(result.success).toBe(false);
  });
});

// ── batchCreatePropertyValuations — branches supplémentaires 2 ────────────────

describe("batchCreatePropertyValuations — branches supplémentaires 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSubscriptionActive.mockResolvedValue({ active: true });
  });

  it("retourne une erreur si abonnement inactif → B41 arm0 L538", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    checkSubscriptionActive.mockResolvedValueOnce({ active: false, message: "Abonnement inactif" });
    const result = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(result).toEqual({ success: false, error: "Abonnement inactif" });
  });

  it("ajoute une erreur si l'immeuble est introuvable → B44 arm0 L551", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue(null);
    const result = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.created).toBe(0);
  });

  it("retourne une erreur si non authentifié → B46 arm0 L575", async () => {
    mockUnauthenticated();
    const result = await batchCreatePropertyValuations(SOCIETY_ID, [BUILDING_ID]);
    expect(result.success).toBe(false);
  });
});

// ── deleteValuation — branches supplémentaires ────────────────────────────────

describe("deleteValuation — branches supplémentaires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si l'évaluation est introuvable → B50 arm0 L627", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.propertyValuation.findFirst.mockResolvedValue(null);
    const result = await deleteValuation(SOCIETY_ID, VALUATION_ID);
    expect(result).toEqual({ success: false, error: "Évaluation introuvable" });
  });

  it("retourne une erreur si non authentifié → B51 arm0 L642", async () => {
    mockUnauthenticated();
    const result = await deleteValuation(SOCIETY_ID, VALUATION_ID);
    expect(result.success).toBe(false);
  });
});

// ── rerunAllValuations — branches supplémentaires ─────────────────────────────

describe("rerunAllValuations — branches supplémentaires", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectBuildingData.mockResolvedValue({});
  });

  it("ne crée pas de comparables si DVF est vide → B55 arm1 L723", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never);
    prismaMock.building.findMany.mockResolvedValue([{ id: BUILDING_ID, societyId: SOCIETY_ID, name: "DVF Vide" }] as never);
    prismaMock.propertyValuation.create.mockResolvedValue({ id: VALUATION_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue({ city: "Lyon", postalCode: "69001", buildingType: "IMMEUBLE" } as never);
    searchDvfTransactions.mockResolvedValue([]);
    callClaude.mockRejectedValue(new Error("no key"));
    callOpenAI.mockRejectedValue(new Error("no key"));
    const result = await rerunAllValuations();
    expect(result.success).toBe(true);
    expect(prismaMock.comparableSale.createMany).not.toHaveBeenCalled();
  });

  it("applique les ternaires de méthodologie costMethod=true → B58 arm1, B59 arm1, B60 arm0", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never);
    prismaMock.building.findMany.mockResolvedValue([{ id: BUILDING_ID, societyId: SOCIETY_ID, name: "Coût Building" }] as never);
    prismaMock.propertyValuation.create.mockResolvedValue({ id: VALUATION_ID } as never);
    prismaMock.building.findFirst.mockResolvedValue(null);
    const resultCostOnly = {
      ...makeAiValuationResult(450000),
      methodology: {
        comparisonMethod: { applied: false, pricePerSqm: null, adjustments: null, resultValue: null, reasoning: "N/A" },
        incomeMethod: { applied: false, grossRentalIncome: null, netRentalIncome: null, capRate: null, resultValue: null, reasoning: "N/A" },
        costMethod: { applied: true, landValue: 200000, constructionCost: 3000000, depreciationRate: 0.1, resultValue: 450000, reasoning: "Coût" },
      },
    };
    callClaude.mockResolvedValueOnce({ result: resultCostOnly, rawResponse: "{}", durationMs: 100, tokenCount: 50 });
    callOpenAI.mockRejectedValue(new Error("no key"));
    const result = await rerunAllValuations();
    expect(result.success).toBe(true);
    expect(prismaMock.aiValuationAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ methodology: "Coût de remplacement" }) })
    );
  });

  it("gère un err non-Error dans la boucle per-building → B62 arm1 L814", async () => {
    mockAuthSession(UserRole.SUPER_ADMIN, SOCIETY_ID);
    prismaMock.userSociety.findMany
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID, role: "SUPER_ADMIN" }] as never)
      .mockResolvedValueOnce([{ societyId: SOCIETY_ID }] as never);
    prismaMock.building.findMany.mockResolvedValue([{ id: BUILDING_ID, societyId: SOCIETY_ID, name: "Crash Building" }] as never);
    prismaMock.propertyValuation.create.mockRejectedValueOnce("non-Error string" as never);
    const result = await rerunAllValuations();
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toContain("Crash Building");
  });
});
