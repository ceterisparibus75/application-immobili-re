import { describe, it, expect } from "vitest";
import { createDiagnosticSchema, updateDiagnosticSchema } from "./diagnostic";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validDiagnostic = {
  buildingId: VALID_CUID,
  type: "DPE",
  performedAt: "2025-01-15",
};

describe("createDiagnosticSchema", () => {
  it("accepte un diagnostic minimal valide", () => {
    expect(createDiagnosticSchema.safeParse(validDiagnostic).success).toBe(true);
  });

  it("accepte un diagnostic complet", () => {
    const result = createDiagnosticSchema.safeParse({
      ...validDiagnostic,
      expiresAt: "2035-01-15",
      result: "Classe C",
      fileUrl: "https://storage.example.com/doc.pdf",
      fileStoragePath: "diagnostics/building-1/dpe.pdf",
      aiAnalysis: "Bon niveau d'isolation",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un buildingId non CUID", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, buildingId: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("rejette un type vide", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, type: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/type de diagnostic est requis/);
    }
  });

  it("rejette une performedAt vide", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, performedAt: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date de réalisation est requise/);
    }
  });

  it("accepte expiresAt null", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, expiresAt: null });
    expect(result.success).toBe(true);
  });

  it("rejette une fileUrl invalide (non-URL)", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, fileUrl: "not-a-url" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/URL invalide/);
    }
  });

  it("accepte fileUrl null", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, fileUrl: null });
    expect(result.success).toBe(true);
  });

  it("accepte fileStoragePath null", () => {
    const result = createDiagnosticSchema.safeParse({ ...validDiagnostic, fileStoragePath: null });
    expect(result.success).toBe(true);
  });
});

describe("updateDiagnosticSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateDiagnosticSchema.safeParse({ id: VALID_CUID, result: "Classe B" }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateDiagnosticSchema.safeParse({ result: "Classe B" }).success).toBe(false);
  });

  it("accepte id seul (tous les autres champs optionnels en update)", () => {
    expect(updateDiagnosticSchema.safeParse({ id: VALID_CUID }).success).toBe(true);
  });
});
