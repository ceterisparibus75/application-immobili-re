import { describe, it, expect } from "vitest";
import {
  upsertSupplierInboxConfigSchema,
  uploadSupplierInvoiceSchema,
  updateSupplierInvoiceDataSchema,
  rejectSupplierInvoiceSchema,
  markSupplierInvoicePaidSchema,
  validateSupplierInvoiceSchema,
} from "./supplier-invoice";

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t";
const VALID_CUID_2 = "clh3x2z4k0001qh8g7z1y2v3u";

describe("upsertSupplierInboxConfigSchema", () => {
  it("accepte une config valide", () => {
    const result = upsertSupplierInboxConfigSchema.safeParse({
      notifyEmails: ["compta@example.com"],
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("isActive vaut true par défaut", () => {
    const result = upsertSupplierInboxConfigSchema.safeParse({ notifyEmails: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isActive).toBe(true);
  });

  it("rejette un email invalide dans la liste", () => {
    const result = upsertSupplierInboxConfigSchema.safeParse({ notifyEmails: ["bad@"] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Email invalide/);
    }
  });

  it("rejette plus de 5 emails", () => {
    const emails = Array.from({ length: 6 }, (_, i) => `user${i}@example.com`);
    const result = upsertSupplierInboxConfigSchema.safeParse({ notifyEmails: emails });
    expect(result.success).toBe(false);
  });

  it("accepte exactement 5 emails (limite)", () => {
    const emails = Array.from({ length: 5 }, (_, i) => `user${i}@example.com`);
    const result = upsertSupplierInboxConfigSchema.safeParse({ notifyEmails: emails });
    expect(result.success).toBe(true);
  });
});

describe("uploadSupplierInvoiceSchema", () => {
  const validUpload = {
    fileName: "facture-edf.pdf",
    storagePath: "supplier-invoices/2025/facture-edf.pdf",
    fileUrl: "https://storage.example.com/facture-edf.pdf",
  };

  it("accepte un upload valide", () => {
    expect(uploadSupplierInvoiceSchema.safeParse(validUpload).success).toBe(true);
  });

  it("accepte avec fileSize optionnel", () => {
    const result = uploadSupplierInvoiceSchema.safeParse({ ...validUpload, fileSize: 102400 });
    expect(result.success).toBe(true);
  });

  it("rejette fileName vide", () => {
    const result = uploadSupplierInvoiceSchema.safeParse({ ...validUpload, fileName: "" });
    expect(result.success).toBe(false);
  });

  it("rejette storagePath vide", () => {
    const result = uploadSupplierInvoiceSchema.safeParse({ ...validUpload, storagePath: "" });
    expect(result.success).toBe(false);
  });

  it("rejette fileSize négatif", () => {
    const result = uploadSupplierInvoiceSchema.safeParse({ ...validUpload, fileSize: -1 });
    expect(result.success).toBe(false);
  });

  it("rejette fileSize non entier", () => {
    const result = uploadSupplierInvoiceSchema.safeParse({ ...validUpload, fileSize: 1024.5 });
    expect(result.success).toBe(false);
  });
});

describe("updateSupplierInvoiceDataSchema", () => {
  it("accepte un id seul (tous les autres champs optionnels)", () => {
    expect(updateSupplierInvoiceDataSchema.safeParse({ id: VALID_CUID }).success).toBe(true);
  });

  it("rejette si id absent", () => {
    expect(updateSupplierInvoiceDataSchema.safeParse({ supplierName: "EDF" }).success).toBe(false);
  });

  it("rejette un supplierIban invalide", () => {
    const result = updateSupplierInvoiceDataSchema.safeParse({ id: VALID_CUID, supplierIban: "bad-iban" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/IBAN invalide/);
    }
  });

  it("accepte un IBAN français valide", () => {
    const result = updateSupplierInvoiceDataSchema.safeParse({
      id: VALID_CUID,
      supplierIban: "FR7630006000011234567890189",
    });
    expect(result.success).toBe(true);
  });

  it("rejette vatRate > 100", () => {
    const result = updateSupplierInvoiceDataSchema.safeParse({ id: VALID_CUID, vatRate: 101 });
    expect(result.success).toBe(false);
  });

  it("coerce amountTTC depuis une chaîne", () => {
    const result = updateSupplierInvoiceDataSchema.safeParse({ id: VALID_CUID, amountTTC: "1500.00" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amountTTC).toBe(1500);
  });

  it("accepte buildingId, leaseId, tenantId null", () => {
    const result = updateSupplierInvoiceDataSchema.safeParse({
      id: VALID_CUID,
      buildingId: null,
      leaseId: null,
      tenantId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("rejectSupplierInvoiceSchema", () => {
  it("accepte un rejet valide", () => {
    const result = rejectSupplierInvoiceSchema.safeParse({
      invoiceId: VALID_CUID,
      reason: "Montant incorrect",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une raison vide", () => {
    const result = rejectSupplierInvoiceSchema.safeParse({ invoiceId: VALID_CUID, reason: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Raison requise/);
    }
  });

  it("rejette une raison trop longue (> 500 chars)", () => {
    const result = rejectSupplierInvoiceSchema.safeParse({
      invoiceId: VALID_CUID,
      reason: "X".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("markSupplierInvoicePaidSchema", () => {
  const validPayment = {
    invoiceId: VALID_CUID,
    paidAt: "2025-06-01",
    bankAccountId: VALID_CUID_2,
  };

  it("accepte un paiement valide", () => {
    expect(markSupplierInvoicePaidSchema.safeParse(validPayment).success).toBe(true);
  });

  it("accepte avec référence optionnelle", () => {
    const result = markSupplierInvoicePaidSchema.safeParse({ ...validPayment, reference: "VIR-001" });
    expect(result.success).toBe(true);
  });

  it("rejette paidAt vide", () => {
    const result = markSupplierInvoicePaidSchema.safeParse({ ...validPayment, paidAt: "" });
    expect(result.success).toBe(false);
  });

  it("rejette une référence trop longue (> 140 chars)", () => {
    const result = markSupplierInvoicePaidSchema.safeParse({
      ...validPayment,
      reference: "X".repeat(141),
    });
    expect(result.success).toBe(false);
  });
});

describe("validateSupplierInvoiceSchema", () => {
  it("accepte un invoiceId CUID valide", () => {
    expect(validateSupplierInvoiceSchema.safeParse({ invoiceId: VALID_CUID }).success).toBe(true);
  });

  it("rejette un invoiceId non CUID", () => {
    expect(validateSupplierInvoiceSchema.safeParse({ invoiceId: "bad" }).success).toBe(false);
  });
});
