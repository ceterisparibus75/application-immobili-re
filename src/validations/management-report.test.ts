import { describe, it, expect } from "vitest";
import { createManagementReportSchema, updateManagementReportSchema } from "./management-report";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validReport = {
  leaseId: VALID_CUID,
  periodStart: "2025-01-01",
  periodEnd: "2025-01-31",
  grossRent: 1200,
  feeAmountHT: 120,
  feeAmountTTC: 144,
  netTransfer: 1056,
};

describe("createManagementReportSchema", () => {
  it("accepte un relevé de gestion valide", () => {
    expect(createManagementReportSchema.safeParse(validReport).success).toBe(true);
  });

  it("accepte avec chargesAmount et notes optionnels", () => {
    const result = createManagementReportSchema.safeParse({
      ...validReport,
      chargesAmount: 80,
      notes: "RAS ce mois-ci",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un leaseId non CUID", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, leaseId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejette periodStart vide", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, periodStart: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date de début est requise/);
    }
  });

  it("rejette periodEnd vide", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, periodEnd: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date de fin est requise/);
    }
  });

  it("rejette grossRent négatif", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, grossRent: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/loyer brut doit être positif/);
    }
  });

  it("rejette feeAmountHT négatif", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, feeAmountHT: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/honoraires HT/);
    }
  });

  it("rejette netTransfer négatif", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, netTransfer: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/montant net/);
    }
  });

  it("coerce grossRent depuis une chaîne", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, grossRent: "1350.00" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.grossRent).toBe(1350);
  });

  it("accepte grossRent = 0", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, grossRent: 0 });
    expect(result.success).toBe(true);
  });

  it("rejette notes trop longues (> 5000 chars)", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, notes: "X".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("accepte chargesAmount null", () => {
    const result = createManagementReportSchema.safeParse({ ...validReport, chargesAmount: null });
    expect(result.success).toBe(true);
  });
});

describe("updateManagementReportSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateManagementReportSchema.safeParse({ id: VALID_CUID, grossRent: 1300 }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateManagementReportSchema.safeParse({ grossRent: 1300 }).success).toBe(false);
  });

  it("accepte id seul (partial)", () => {
    expect(updateManagementReportSchema.safeParse({ id: VALID_CUID }).success).toBe(true);
  });
});
