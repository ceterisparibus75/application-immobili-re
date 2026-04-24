import { describe, it, expect } from "vitest";
import { createChargeProvisionSchema, updateChargeProvisionSchema, PROVISION_LABELS } from "./chargeProvision";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";

const validProvision = {
  leaseId: VALID_CUID,
  lotId: VALID_CUID_2,
  label: "Provision sur charges",
  monthlyAmount: 150,
  startDate: "2025-01-01",
};

describe("PROVISION_LABELS", () => {
  it("contient 5 libellés", () => {
    expect(PROVISION_LABELS).toHaveLength(5);
    expect(PROVISION_LABELS).toContain("Taxe foncière");
    expect(PROVISION_LABELS).toContain("Provision sur charges");
  });
});

describe("createChargeProvisionSchema", () => {
  it("accepte une provision minimale valide", () => {
    expect(createChargeProvisionSchema.safeParse(validProvision).success).toBe(true);
  });

  it("vatRate vaut 20 par défaut", () => {
    const result = createChargeProvisionSchema.safeParse(validProvision);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.vatRate).toBe(20);
  });

  it("rejette un leaseId non CUID", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, leaseId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejette un lotId non CUID", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, lotId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejette un label vide", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, label: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/libellé est requis/);
    }
  });

  it("rejette un label trop long (> 100 chars)", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, label: "X".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejette monthlyAmount = 0 (doit être > 0)", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, monthlyAmount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/supérieur à 0/);
    }
  });

  it("rejette monthlyAmount négatif", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, monthlyAmount: -10 });
    expect(result.success).toBe(false);
  });

  it("coerce monthlyAmount depuis une chaîne", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, monthlyAmount: "200.50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.monthlyAmount).toBe(200.5);
  });

  it("rejette un vatRate > 100", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, vatRate: 101 });
    expect(result.success).toBe(false);
  });

  it("rejette un vatRate négatif", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, vatRate: -1 });
    expect(result.success).toBe(false);
  });

  it("accepte vatRate = 0 (franchise)", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, vatRate: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.vatRate).toBe(0);
  });

  it("rejette startDate vide", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, startDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/date de début est requise/);
    }
  });

  it("accepte endDate null", () => {
    const result = createChargeProvisionSchema.safeParse({ ...validProvision, endDate: null });
    expect(result.success).toBe(true);
  });
});

describe("updateChargeProvisionSchema", () => {
  // Note : updateChargeProvisionSchema = omit sans .partial()
  // label, monthlyAmount et startDate restent requis
  const validUpdate = {
    id: VALID_CUID,
    label: "Provision sur charges",
    monthlyAmount: 200,
    startDate: "2025-01-01",
  };

  it("accepte une mise à jour valide avec tous les champs requis", () => {
    expect(updateChargeProvisionSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateChargeProvisionSchema.safeParse({ label: "Provision", monthlyAmount: 200, startDate: "2025-01-01" }).success).toBe(false);
  });

  it("accepte isActive en supplément", () => {
    const result = updateChargeProvisionSchema.safeParse({ ...validUpdate, isActive: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isActive).toBe(false);
  });

  it("rejette monthlyAmount = 0 en update aussi", () => {
    const result = updateChargeProvisionSchema.safeParse({ ...validUpdate, monthlyAmount: 0 });
    expect(result.success).toBe(false);
  });
});
