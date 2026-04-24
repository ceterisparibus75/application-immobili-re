import { describe, it, expect } from "vitest";
import { createLeaseTemplateSchema, updateLeaseTemplateSchema } from "./lease-template";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validTemplate = {
  name: "Modèle bail habitation",
  leaseType: "HABITATION" as const,
};

describe("createLeaseTemplateSchema", () => {
  it("accepte un modèle minimal valide", () => {
    expect(createLeaseTemplateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("isDefault vaut false par défaut", () => {
    const result = createLeaseTemplateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isDefault).toBe(false);
  });

  it("rejette nom vide", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/requis/);
    }
  });

  it("rejette nom trop long (> 200 chars)", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, name: "N".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejette un leaseType invalide", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, leaseType: "INCONNU" });
    expect(result.success).toBe(false);
  });

  it("accepte tous les leaseType valides", () => {
    for (const leaseType of ["HABITATION", "MEUBLE", "COMMERCIAL_369", "EMPHYTEOTIQUE", "RURAL"]) {
      expect(createLeaseTemplateSchema.safeParse({ ...validTemplate, leaseType }).success).toBe(true);
    }
  });

  it("accepte description optionnelle", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, description: "Un modèle standard" });
    expect(result.success).toBe(true);
  });

  it("accepte description null", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, description: null });
    expect(result.success).toBe(true);
  });

  it("rejette description trop longue (> 2000 chars)", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, description: "X".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("accepte les clauses optionnelles", () => {
    const result = createLeaseTemplateSchema.safeParse({
      ...validTemplate,
      headerContent: "En-tête du bail",
      partiesClause: "Le bailleur...",
      rentClause: "Le loyer est fixé à...",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une clause trop longue (> 10000 chars)", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, rentClause: "X".repeat(10001) });
    expect(result.success).toBe(false);
  });

  it("accepte les valeurs par défaut optionnelles", () => {
    const result = createLeaseTemplateSchema.safeParse({
      ...validTemplate,
      defaultDurationMonths: 12,
      defaultPaymentFrequency: "MENSUEL",
      defaultBillingTerm: "ECHU",
      defaultVatApplicable: true,
      defaultVatRate: 20,
      defaultIndexType: "IRL",
      defaultDepositMonths: 2,
    });
    expect(result.success).toBe(true);
  });

  it("coerce defaultDurationMonths depuis une chaîne", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultDurationMonths: "12" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.defaultDurationMonths).toBe(12);
  });

  it("rejette defaultDurationMonths < 1", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultDurationMonths: 0 });
    expect(result.success).toBe(false);
  });

  it("rejette defaultPaymentFrequency invalide", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultPaymentFrequency: "HEBDOMADAIRE" });
    expect(result.success).toBe(false);
  });

  it("rejette defaultBillingTerm invalide", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultBillingTerm: "INCONNU" });
    expect(result.success).toBe(false);
  });

  it("rejette defaultVatRate > 100", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultVatRate: 101 });
    expect(result.success).toBe(false);
  });

  it("rejette defaultVatRate < 0", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultVatRate: -1 });
    expect(result.success).toBe(false);
  });

  it("accepte tous les defaultIndexType valides", () => {
    for (const defaultIndexType of ["IRL", "ILC", "ILAT", "ICC"]) {
      expect(createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultIndexType }).success).toBe(true);
    }
  });

  it("rejette defaultIndexType invalide", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultIndexType: "INSEE" });
    expect(result.success).toBe(false);
  });

  it("accepte defaultDepositMonths = 0", () => {
    const result = createLeaseTemplateSchema.safeParse({ ...validTemplate, defaultDepositMonths: 0 });
    expect(result.success).toBe(true);
  });
});

describe("updateLeaseTemplateSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateLeaseTemplateSchema.safeParse({ id: VALID_CUID, name: "Nouveau nom" }).success).toBe(true);
  });

  it("accepte id seul (partial)", () => {
    expect(updateLeaseTemplateSchema.safeParse({ id: VALID_CUID }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateLeaseTemplateSchema.safeParse({ name: "Nouveau nom" }).success).toBe(false);
  });

  it("rejette si id non CUID", () => {
    expect(updateLeaseTemplateSchema.safeParse({ id: "bad-id" }).success).toBe(false);
  });

  it("accepte isActive optionnel", () => {
    expect(updateLeaseTemplateSchema.safeParse({ id: VALID_CUID, isActive: false }).success).toBe(true);
  });
});
