import { describe, it, expect } from "vitest";
import { generateLetterSchema, saveCustomTemplateSchema } from "./letter-template";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";

describe("generateLetterSchema", () => {
  const validGenerate = {
    templateId: "tpl-relance",
    values: { nom: "Dupont", loyer: "850" },
  };

  it("accepte une génération valide", () => {
    expect(generateLetterSchema.safeParse(validGenerate).success).toBe(true);
  });

  it("accepte values vide (pas de variables)", () => {
    const result = generateLetterSchema.safeParse({ ...validGenerate, values: {} });
    expect(result.success).toBe(true);
  });

  it("rejette templateId vide", () => {
    const result = generateLetterSchema.safeParse({ ...validGenerate, templateId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/requis/);
    }
  });

  it("accepte tenantId CUID optionnel", () => {
    const result = generateLetterSchema.safeParse({ ...validGenerate, tenantId: VALID_CUID });
    expect(result.success).toBe(true);
  });

  it("rejette tenantId non CUID", () => {
    const result = generateLetterSchema.safeParse({ ...validGenerate, tenantId: "bad" });
    expect(result.success).toBe(false);
  });

  it("accepte leaseId CUID optionnel", () => {
    const result = generateLetterSchema.safeParse({ ...validGenerate, leaseId: VALID_CUID_2 });
    expect(result.success).toBe(true);
  });

  it("rejette leaseId non CUID", () => {
    const result = generateLetterSchema.safeParse({ ...validGenerate, leaseId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("accepte tenantId et leaseId ensemble", () => {
    const result = generateLetterSchema.safeParse({
      ...validGenerate,
      tenantId: VALID_CUID,
      leaseId: VALID_CUID_2,
    });
    expect(result.success).toBe(true);
  });
});

describe("saveCustomTemplateSchema", () => {
  const validTemplate = {
    name: "Relance impayés",
    subject: "Rappel de paiement",
    bodyHtml: "<p>Bonjour {{nom}}, votre loyer est en retard.</p>",
    variables: ["nom", "loyer", "date"],
  };

  it("accepte un modèle valide", () => {
    expect(saveCustomTemplateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("accepte variables vide", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, variables: [] });
    expect(result.success).toBe(true);
  });

  it("rejette nom trop court (< 2 chars)", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 caractères/);
    }
  });

  it("rejette nom trop long (> 100 chars)", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, name: "N".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejette subject trop court (< 2 chars)", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, subject: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 caractères/);
    }
  });

  it("rejette subject trop long (> 200 chars)", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, subject: "S".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejette bodyHtml trop court (< 10 chars)", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, bodyHtml: "<p>Hi</p>" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop court/);
    }
  });

  it("accepte bodyHtml avec exactement 10 chars", () => {
    const result = saveCustomTemplateSchema.safeParse({ ...validTemplate, bodyHtml: "1234567890" });
    expect(result.success).toBe(true);
  });
});
