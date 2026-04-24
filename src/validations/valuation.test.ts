import { describe, it, expect } from "vitest";
import {
  createValuationSchema,
  runAiAnalysisSchema,
  uploadExpertReportSchema,
  searchComparablesSchema,
  updateValuationResultsSchema,
  createRentValuationSchema,
  runRentAiAnalysisSchema,
  searchComparableRentsSchema,
} from "./valuation";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("createValuationSchema", () => {
  it("accepte un buildingId CUID valide", () => {
    expect(createValuationSchema.safeParse({ buildingId: VALID_CUID }).success).toBe(true);
  });

  it("rejette un buildingId non CUID", () => {
    const result = createValuationSchema.safeParse({ buildingId: "bad-id" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Identifiant d'immeuble invalide/);
    }
  });
});

describe("runAiAnalysisSchema", () => {
  it("accepte CLAUDE seul", () => {
    expect(runAiAnalysisSchema.safeParse({ providers: ["CLAUDE"] }).success).toBe(true);
  });

  it("accepte OPENAI seul", () => {
    expect(runAiAnalysisSchema.safeParse({ providers: ["OPENAI"] }).success).toBe(true);
  });

  it("accepte les deux providers", () => {
    expect(runAiAnalysisSchema.safeParse({ providers: ["CLAUDE", "OPENAI"] }).success).toBe(true);
  });

  it("rejette un tableau vide", () => {
    const result = runAiAnalysisSchema.safeParse({ providers: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Au moins un fournisseur/);
    }
  });

  it("rejette un provider inconnu", () => {
    const result = runAiAnalysisSchema.safeParse({ providers: ["GEMINI"] });
    expect(result.success).toBe(false);
  });
});

describe("uploadExpertReportSchema", () => {
  it("accepte un rapport valide", () => {
    const result = uploadExpertReportSchema.safeParse({
      expertName: "Cabinet Dupont",
      reportDate: "2025-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un nom d'expert trop court (< 2 chars)", () => {
    const result = uploadExpertReportSchema.safeParse({ expertName: "D", reportDate: "2025-06-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/nom de l'expert est requis/);
    }
  });

  it("rejette une date de rapport vide", () => {
    const result = uploadExpertReportSchema.safeParse({ expertName: "Cabinet Dupont", reportDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date du rapport est requise/);
    }
  });

  it("accepte reportReference optionnel", () => {
    const result = uploadExpertReportSchema.safeParse({
      expertName: "Cabinet Dupont",
      reportDate: "2025-06-01",
      reportReference: "EXP-2025-001",
    });
    expect(result.success).toBe(true);
  });
});

describe("searchComparablesSchema", () => {
  it("accepte des paramètres vides (defaults appliqués)", () => {
    const result = searchComparablesSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radiusKm).toBe(5);
      expect(result.data.periodYears).toBe(3);
    }
  });

  it("rejette radiusKm < 0.5", () => {
    const result = searchComparablesSchema.safeParse({ radiusKm: 0.4 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/0,5 km/);
    }
  });

  it("rejette radiusKm > 50", () => {
    const result = searchComparablesSchema.safeParse({ radiusKm: 51 });
    expect(result.success).toBe(false);
  });

  it("rejette periodYears < 1", () => {
    const result = searchComparablesSchema.safeParse({ periodYears: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/1 an/);
    }
  });

  it("rejette periodYears > 10", () => {
    const result = searchComparablesSchema.safeParse({ periodYears: 11 });
    expect(result.success).toBe(false);
  });

  it("rejette periodYears non entier", () => {
    const result = searchComparablesSchema.safeParse({ periodYears: 2.5 });
    expect(result.success).toBe(false);
  });

  it("coerce radiusKm depuis une chaîne", () => {
    const result = searchComparablesSchema.safeParse({ radiusKm: "10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.radiusKm).toBe(10);
  });
});

describe("updateValuationResultsSchema", () => {
  it("accepte un objet vide (tout optionnel)", () => {
    expect(updateValuationResultsSchema.safeParse({}).success).toBe(true);
  });

  it("accepte des valeurs estimées valides", () => {
    const result = updateValuationResultsSchema.safeParse({
      estimatedValueLow: 400000,
      estimatedValueMid: 500000,
      estimatedValueHigh: 600000,
      estimatedRentalValue: 2500,
      pricePerSqm: 4000,
      capitalizationRate: 5.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejette un taux de capitalisation > 100", () => {
    const result = updateValuationResultsSchema.safeParse({ capitalizationRate: 101 });
    expect(result.success).toBe(false);
  });

  it("rejette des valeurs négatives", () => {
    const result = updateValuationResultsSchema.safeParse({ estimatedValueMid: -1 });
    expect(result.success).toBe(false);
  });

  it("accepte les valeurs null", () => {
    const result = updateValuationResultsSchema.safeParse({
      estimatedValueLow: null,
      estimatedValueMid: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("createRentValuationSchema", () => {
  it("accepte un leaseId CUID valide", () => {
    expect(createRentValuationSchema.safeParse({ leaseId: VALID_CUID }).success).toBe(true);
  });

  it("rejette un leaseId non CUID", () => {
    const result = createRentValuationSchema.safeParse({ leaseId: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Identifiant de bail invalide/);
    }
  });
});

describe("searchComparableRentsSchema", () => {
  it("applique les mêmes defaults que searchComparablesSchema", () => {
    const result = searchComparableRentsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.radiusKm).toBe(5);
      expect(result.data.periodYears).toBe(3);
    }
  });
});
