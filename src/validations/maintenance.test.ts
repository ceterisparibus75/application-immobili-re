import { describe, it, expect } from "vitest";
import { createMaintenanceSchema, updateMaintenanceSchema } from "./maintenance";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";

const validMaintenance = {
  buildingId: VALID_CUID,
  title: "Réparation toiture",
};

describe("createMaintenanceSchema", () => {
  it("accepte une maintenance minimale valide", () => {
    expect(createMaintenanceSchema.safeParse(validMaintenance).success).toBe(true);
  });

  it("accepte une maintenance complète", () => {
    const result = createMaintenanceSchema.safeParse({
      buildingId: VALID_CUID,
      lotId: VALID_CUID_2,
      title: "Réparation plomberie",
      description: "Fuite sous évier",
      scheduledAt: "2025-06-01",
      completedAt: "2025-06-05",
      cost: 350.5,
      isPaid: true,
      notes: "Effectué par plombier Dupont",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un buildingId non CUID", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, buildingId: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("rejette un titre trop court (< 2 chars)", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, title: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/titre est requis/);
    }
  });

  it("rejette un titre trop long (> 200 chars)", () => {
    const result = createMaintenanceSchema.safeParse({
      ...validMaintenance,
      title: "X".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejette un coût négatif", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, cost: -50 });
    expect(result.success).toBe(false);
  });

  it("accepte cost = 0", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, cost: 0 });
    expect(result.success).toBe(true);
  });

  it("transforme isPaid=true (boolean) → true", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, isPaid: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPaid).toBe(true);
  });

  it("transforme isPaid='true' (string) → true", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, isPaid: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPaid).toBe(true);
  });

  it("transforme isPaid='on' (checkbox) → true", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, isPaid: "on" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPaid).toBe(true);
  });

  it("transforme isPaid=false → false", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, isPaid: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPaid).toBe(false);
  });

  it("transforme isPaid='false' → false", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, isPaid: "false" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPaid).toBe(false);
  });

  it("isPaid vaut false par défaut si absent", () => {
    const result = createMaintenanceSchema.safeParse(validMaintenance);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isPaid).toBe(false);
  });

  it("accepte lotId null", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, lotId: null });
    expect(result.success).toBe(true);
  });

  it("coerce cost depuis une chaîne numérique", () => {
    const result = createMaintenanceSchema.safeParse({ ...validMaintenance, cost: "200.50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cost).toBe(200.5);
  });
});

describe("updateMaintenanceSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    const result = updateMaintenanceSchema.safeParse({
      id: VALID_CUID,
      title: "Nouveau titre",
    });
    expect(result.success).toBe(true);
  });

  it("rejette si id est absent", () => {
    const result = updateMaintenanceSchema.safeParse({ title: "Titre" });
    expect(result.success).toBe(false);
  });

  it("accepte une mise à jour avec id seul (tous les autres champs optionnels)", () => {
    const result = updateMaintenanceSchema.safeParse({ id: VALID_CUID });
    expect(result.success).toBe(true);
  });
});
