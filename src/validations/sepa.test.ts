import { describe, it, expect } from "vitest";
import { createSepaMandateSchema, createSepaPaymentSchema } from "./sepa";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("createSepaMandateSchema", () => {
  const validMandate = {
    iban: "FR7630006000011234567890189",
    accountHolderName: "Alice Martin",
  };

  it("accepte un mandat valide", () => {
    expect(createSepaMandateSchema.safeParse(validMandate).success).toBe(true);
  });

  it("rejette un IBAN trop court (< 15 chars)", () => {
    const result = createSepaMandateSchema.safeParse({ ...validMandate, iban: "FR763000600" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop court/);
    }
  });

  it("rejette un IBAN trop long (> 34 chars)", () => {
    const result = createSepaMandateSchema.safeParse({
      ...validMandate,
      iban: "FR" + "1".repeat(34),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/trop long/);
    }
  });

  it("rejette un IBAN avec format invalide (lettres minuscules)", () => {
    const result = createSepaMandateSchema.safeParse({ ...validMandate, iban: "fr7630006000011234567890189" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/invalide/);
    }
  });

  it("rejette un IBAN ne commençant pas par 2 lettres majuscules", () => {
    const result = createSepaMandateSchema.safeParse({ ...validMandate, iban: "1234567890123456" });
    expect(result.success).toBe(false);
  });

  it("rejette un accountHolderName trop court (< 2 chars)", () => {
    const result = createSepaMandateSchema.safeParse({ ...validMandate, accountHolderName: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/titulaire requis/);
    }
  });

  it("accepte un IBAN à 15 chars (longueur minimale)", () => {
    // Norvège : NO + 2 chiffres + 11 chiffres = 15 chars
    const result = createSepaMandateSchema.safeParse({
      ...validMandate,
      iban: "NO9386011117947",
    });
    expect(result.success).toBe(true);
  });
});

describe("createSepaPaymentSchema", () => {
  const validPayment = {
    mandateId: VALID_CUID,
    invoiceId: VALID_CUID,
    amount: 500,
  };

  it("accepte un paiement valide", () => {
    expect(createSepaPaymentSchema.safeParse(validPayment).success).toBe(true);
  });

  it("accepte un paiement avec description et chargeDate optionnels", () => {
    const result = createSepaPaymentSchema.safeParse({
      ...validPayment,
      description: "Loyer mars 2025",
      chargeDate: "2025-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un mandateId non CUID", () => {
    const result = createSepaPaymentSchema.safeParse({ ...validPayment, mandateId: "not-a-cuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/mandat invalide/);
    }
  });

  it("rejette un montant négatif", () => {
    const result = createSepaPaymentSchema.safeParse({ ...validPayment, amount: -10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/positif/);
    }
  });

  it("rejette un montant à zéro", () => {
    const result = createSepaPaymentSchema.safeParse({ ...validPayment, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejette une chargeDate avec format invalide", () => {
    const result = createSepaPaymentSchema.safeParse({
      ...validPayment,
      chargeDate: "01/03/2025",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/YYYY-MM-DD/);
    }
  });

  it("accepte chargeDate au format YYYY-MM-DD", () => {
    const result = createSepaPaymentSchema.safeParse({
      ...validPayment,
      chargeDate: "2025-12-31",
    });
    expect(result.success).toBe(true);
  });
});
