import { describe, it, expect } from "vitest";
import { createInspectionSchema, updateInspectionSchema } from "./inspection";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validInspection = {
  leaseId: VALID_CUID,
  type: "ENTREE" as const,
  performedAt: "2025-06-01",
};

describe("createInspectionSchema", () => {
  it("accepte une inspection minimale valide", () => {
    expect(createInspectionSchema.safeParse(validInspection).success).toBe(true);
  });

  it("accepte une inspection complète avec pièces", () => {
    const result = createInspectionSchema.safeParse({
      ...validInspection,
      type: "SORTIE",
      performedBy: "Agent Dupont",
      generalNotes: "Bon état général",
      rooms: [
        { name: "Salon", condition: "BON", notes: null },
        { name: "Cuisine", condition: "USAGE_NORMAL", notes: "Légère usure plan de travail" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejette un leaseId non CUID", () => {
    const result = createInspectionSchema.safeParse({ ...validInspection, leaseId: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("rejette un type invalide", () => {
    const result = createInspectionSchema.safeParse({ ...validInspection, type: "CONTRADICTOIRE" });
    expect(result.success).toBe(false);
  });

  it("rejette performedAt vide", () => {
    const result = createInspectionSchema.safeParse({ ...validInspection, performedAt: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date est requise/);
    }
  });

  it("rooms est un tableau vide par défaut", () => {
    const result = createInspectionSchema.safeParse(validInspection);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rooms).toEqual([]);
  });

  it("rejette une pièce avec nom vide", () => {
    const result = createInspectionSchema.safeParse({
      ...validInspection,
      rooms: [{ name: "", condition: "BON" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/nom de la pièce est requis/);
    }
  });

  it("rejette une pièce avec condition invalide", () => {
    const result = createInspectionSchema.safeParse({
      ...validInspection,
      rooms: [{ name: "Salon", condition: "PARFAIT" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepte toutes les conditions de pièce valides", () => {
    for (const condition of ["BON", "USAGE_NORMAL", "DEGRADE", "TRES_DEGRADE"]) {
      const result = createInspectionSchema.safeParse({
        ...validInspection,
        rooms: [{ name: "Pièce", condition }],
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepte performedBy null", () => {
    const result = createInspectionSchema.safeParse({ ...validInspection, performedBy: null });
    expect(result.success).toBe(true);
  });
});

describe("updateInspectionSchema", () => {
  it("accepte une mise à jour valide", () => {
    expect(updateInspectionSchema.safeParse({ id: VALID_CUID, performedBy: "Dupont" }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateInspectionSchema.safeParse({ performedBy: "Dupont" }).success).toBe(false);
  });

  it("rejette une signedFileUrl invalide (non-URL)", () => {
    const result = updateInspectionSchema.safeParse({ id: VALID_CUID, signedFileUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepte signedFileUrl null", () => {
    const result = updateInspectionSchema.safeParse({ id: VALID_CUID, signedFileUrl: null });
    expect(result.success).toBe(true);
  });
});
