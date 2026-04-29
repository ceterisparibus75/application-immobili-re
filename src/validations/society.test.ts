import { describe, it, expect } from "vitest";
import { createSocietySchema, updateSocietySchema } from "./society";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validSociety = {
  name: "SCI Les Pins",
  legalForm: "SCI" as const,
  addressLine1: "12 rue de la Paix",
  city: "Paris",
  postalCode: "75001",
  taxRegime: "IR" as const,
  vatRegime: "FRANCHISE" as const,
};

describe("createSocietySchema", () => {
  it("accepte une société minimale valide", () => {
    expect(createSocietySchema.safeParse(validSociety).success).toBe(true);
  });

  it("country vaut 'France' par défaut", () => {
    const result = createSocietySchema.safeParse(validSociety);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.country).toBe("France");
  });

  it("rejette un nom trop court (< 2 chars)", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 caractères/);
    }
  });

  it("rejette une forme juridique invalide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, legalForm: "ASSOCIATION" });
    expect(result.success).toBe(false);
  });

  it("accepte toutes les formes juridiques valides", () => {
    const forms = [
      "PERSONNE_PHYSIQUE",
      "EI",
      "EURL",
      "SASU",
      "SARL",
      "SAS",
      "SA",
      "SNC",
      "SCS",
      "SCA",
      "SCI",
      "SCM",
      "SCP",
      "SCPI",
      "SCCV",
      "SELARL",
      "SELAS",
      "SPFPL",
      "GIE",
      "GFA",
      "AUTRE",
    ];
    for (const legalForm of forms) {
      expect(createSocietySchema.safeParse({ ...validSociety, legalForm }).success).toBe(true);
    }
  });

  it("rejette un SIRET avec moins de 14 chiffres", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, siret: "1234567890" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/14 chiffres/);
    }
  });

  it("rejette un SIRET avec des lettres", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, siret: "1234567890ABCD" });
    expect(result.success).toBe(false);
  });

  it("accepte un SIRET valide (14 chiffres)", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, siret: "73282932000074" });
    expect(result.success).toBe(true);
  });

  it("accepte siret comme chaîne vide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, siret: "" });
    expect(result.success).toBe(true);
  });

  it("rejette un code postal qui n'est pas 5 chiffres", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, postalCode: "7500" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/5 chiffres/);
    }
  });

  it("rejette un code postal avec lettres", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, postalCode: "7501A" });
    expect(result.success).toBe(false);
  });

  it("rejette une adresse vide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, addressLine1: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/adresse est obligatoire/);
    }
  });

  it("rejette une ville vide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, city: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/ville est obligatoire/);
    }
  });

  it("rejette un numéro de TVA invalide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, vatNumber: "BE1234567890" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Format TVA invalide/);
    }
  });

  it("accepte un numéro de TVA français valide (FR + 2 chiffres + 9 chiffres)", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, vatNumber: "FR73732829320" });
    expect(result.success).toBe(true);
  });

  it("accepte vatNumber comme chaîne vide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, vatNumber: "" });
    expect(result.success).toBe(true);
  });

  it("rejette un email comptable invalide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, accountantEmail: "bad@" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("accepte accountantEmail comme chaîne vide", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, accountantEmail: "" });
    expect(result.success).toBe(true);
  });

  it("rejette un invoicePrefix trop long (> 10 chars)", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, invoicePrefix: "TOOLONGPREFIX" });
    expect(result.success).toBe(false);
  });

  it("coerce shareCapital depuis une chaîne numérique", () => {
    const result = createSocietySchema.safeParse({ ...validSociety, shareCapital: "1000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.shareCapital).toBe(1000);
  });
});

describe("updateSocietySchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateSocietySchema.safeParse({ id: VALID_CUID, name: "SCI Nouvelle" }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateSocietySchema.safeParse({ name: "SCI Nouvelle" }).success).toBe(false);
  });

  it("valide le SIRET même en update", () => {
    const result = updateSocietySchema.safeParse({ id: VALID_CUID, siret: "123" });
    expect(result.success).toBe(false);
  });
});
