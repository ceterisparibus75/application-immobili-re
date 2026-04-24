import { describe, it, expect } from "vitest";
import { createContactSchema, updateContactSchema } from "./contact";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validContact = {
  contactType: "PRESTATAIRE" as const,
  name: "Dupont Plomberie",
};

describe("createContactSchema", () => {
  it("accepte un contact minimal valide", () => {
    expect(createContactSchema.safeParse(validContact).success).toBe(true);
  });

  it("accepte un contact complet", () => {
    const result = createContactSchema.safeParse({
      ...validContact,
      company: "SARL Dupont",
      specialty: "Plomberie",
      email: "contact@dupont.fr",
      phone: "0102030405",
      mobile: "0612345678",
      addressLine1: "12 rue des Artisans",
      city: "Paris",
      postalCode: "75011",
      notes: "Intervient rapidement",
    });
    expect(result.success).toBe(true);
  });

  it("accepte tous les contactType valides", () => {
    const types = ["LOCATAIRE", "PRESTATAIRE", "NOTAIRE", "EXPERT", "SYNDIC", "AGENCE", "AUTRE"];
    for (const contactType of types) {
      expect(createContactSchema.safeParse({ ...validContact, contactType }).success).toBe(true);
    }
  });

  it("rejette un contactType invalide", () => {
    const result = createContactSchema.safeParse({ ...validContact, contactType: "BANQUIER" });
    expect(result.success).toBe(false);
  });

  it("rejette un nom vide", () => {
    const result = createContactSchema.safeParse({ ...validContact, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/nom est requis/);
    }
  });

  it("rejette un email invalide non vide", () => {
    const result = createContactSchema.safeParse({ ...validContact, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("accepte email comme chaîne vide (via .or(z.literal('')))", () => {
    // L'email peut être "" pour permettre la soumission depuis un formulaire vide
    const result = createContactSchema.safeParse({ ...validContact, email: "" });
    expect(result.success).toBe(true);
  });

  it("accepte email null", () => {
    const result = createContactSchema.safeParse({ ...validContact, email: null });
    expect(result.success).toBe(true);
  });

  it("accepte company null", () => {
    expect(createContactSchema.safeParse({ ...validContact, company: null }).success).toBe(true);
  });

  it("accepte phone null", () => {
    expect(createContactSchema.safeParse({ ...validContact, phone: null }).success).toBe(true);
  });

  it("accepte mobile null", () => {
    expect(createContactSchema.safeParse({ ...validContact, mobile: null }).success).toBe(true);
  });
});

describe("updateContactSchema", () => {
  it("accepte une mise à jour partielle avec id", () => {
    expect(updateContactSchema.safeParse({ id: VALID_CUID, name: "Nouveau Nom" }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateContactSchema.safeParse({ name: "Nouveau Nom" }).success).toBe(false);
  });

  it("valide l'email dans une mise à jour", () => {
    const result = updateContactSchema.safeParse({ id: VALID_CUID, email: "bad@" });
    expect(result.success).toBe(false);
  });
});
