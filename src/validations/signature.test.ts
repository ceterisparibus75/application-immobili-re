import { describe, it, expect } from "vitest";
import { createSignatureRequestSchema } from "./signature";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";

const validRequest = {
  documentType: "BAIL" as const,
  documentName: "Bail d'habitation - Lot 3A",
  documentBase64: "JVBERi0xLjQK...", // PDF base64 simulé
  signerEmail: "locataire@example.com",
  signerName: "Alice Martin",
};

describe("createSignatureRequestSchema", () => {
  it("accepte une demande de signature valide", () => {
    expect(createSignatureRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("embedded vaut false par défaut", () => {
    const result = createSignatureRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.embedded).toBe(false);
  });

  it("accepte tous les documentType valides", () => {
    for (const documentType of ["BAIL", "ETAT_DES_LIEUX", "MANDAT", "AUTRE"]) {
      expect(createSignatureRequestSchema.safeParse({ ...validRequest, documentType }).success).toBe(true);
    }
  });

  it("rejette un documentType invalide", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, documentType: "CONTRAT" });
    expect(result.success).toBe(false);
  });

  it("rejette documentName vide", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, documentName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Nom du document requis/);
    }
  });

  it("rejette documentName trop long (> 200 chars)", () => {
    const result = createSignatureRequestSchema.safeParse({
      ...validRequest,
      documentName: "N".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejette documentBase64 vide", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, documentBase64: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Document PDF requis/);
    }
  });

  it("rejette un email signataire invalide", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, signerEmail: "bad@" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("rejette signerName vide", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, signerName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Nom du signataire requis/);
    }
  });

  it("rejette une returnUrl invalide (non-URL)", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, returnUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepte returnUrl valide", () => {
    const result = createSignatureRequestSchema.safeParse({
      ...validRequest,
      returnUrl: "https://app.example.com/retour",
    });
    expect(result.success).toBe(true);
  });

  it("accepte documentId CUID optionnel", () => {
    const result = createSignatureRequestSchema.safeParse({ ...validRequest, documentId: VALID_CUID });
    expect(result.success).toBe(true);
  });

  it("accepte embedded=true avec returnUrl", () => {
    const result = createSignatureRequestSchema.safeParse({
      ...validRequest,
      embedded: true,
      returnUrl: "https://app.example.com/retour",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.embedded).toBe(true);
  });
});
