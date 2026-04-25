import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/gocardless-sepa", () => ({
  createSepaMandateForTenant: vi.fn().mockResolvedValue({
    mandateId: "gc-mandate-1",
    ibanLast4: "1234",
    bankName: "BNP Paribas",
    mandateReference: "REF-001",
  }),
  createPayment: vi.fn().mockResolvedValue({ id: "gc-payment-1" }),
  cancelMandate: vi.fn().mockResolvedValue(undefined),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { createSepaMandate, triggerSepaPayment, cancelSepaMandate, getSepaMandates } from "./sepa";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const TENANT_ID = "clh3x2z4k0001qh8g7z1y2v3t";
const MANDATE_ID = "clh3x2z4k0002qh8g7z1y2v3t";
const INVOICE_ID = "clh3x2z4k0003qh8g7z1y2v3t";

const validMandateInput = {
  iban: "FR7630006000011234567890189",
  accountHolderName: "Jean Dupont",
};

const validPaymentInput = {
  mandateId: MANDATE_ID,
  invoiceId: INVOICE_ID,
  amount: 850,
};

function makeTenant(overrides = {}) {
  return {
    id: TENANT_ID,
    societyId: SOCIETY_ID,
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean@example.com",
    companyName: null,
    legalRepName: null,
    ...overrides,
  };
}

function makeMandate(overrides = {}) {
  return {
    id: MANDATE_ID,
    societyId: SOCIETY_ID,
    tenantId: TENANT_ID,
    gocardlessId: "gc-mandate-1",
    status: "ACTIVE",
    ibanLast4: "1234",
    bankName: "BNP Paribas",
    mandateReference: "REF-001",
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    id: INVOICE_ID,
    societyId: SOCIETY_ID,
    invoiceNumber: "FAC-2025-001",
    totalTTC: 850,
    ...overrides,
  };
}

describe("createSepaMandate", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, validMandateInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (IBAN invalide)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, { ...validMandateInput, iban: "invalide" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si locataire introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue(null);

    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, validMandateInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Locataire introuvable/);
  });

  it("retourne une erreur si le locataire n'a pas d'email", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue(makeTenant({ email: null }) as never);

    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, validMandateInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/);
  });

  it("crée le mandat SEPA avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.tenant.findFirst.mockResolvedValue(makeTenant() as never);
    prismaMock.sepaMandate.create.mockResolvedValue({
      id: "mandate-db-1",
      mandateReference: "REF-001",
    } as never);

    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, validMandateInput);
    expect(result.success).toBe(true);
    expect(result.data?.mandateReference).toBe("REF-001");
    expect(prismaMock.sepaMandate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: SOCIETY_ID,
          tenantId: TENANT_ID,
          status: "ACTIVE",
        }),
      })
    );
  });
});

describe("triggerSepaPayment", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue (mandateId invalide)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await triggerSepaPayment(SOCIETY_ID, { ...validPaymentInput, mandateId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si mandat introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockResolvedValue(null);

    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Mandat introuvable/);
  });

  it("retourne une erreur si mandat non actif", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockResolvedValue(makeMandate({ status: "CANCELLED" }) as never);

    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non actif/);
  });

  it("retourne une erreur si facture introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockResolvedValue(makeMandate() as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Facture introuvable/);
  });

  it("déclenche le prélèvement SEPA avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockResolvedValue(makeMandate() as never);
    prismaMock.invoice.findFirst.mockResolvedValue(makeInvoice() as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(true);
    expect(result.data?.paymentId).toBe("gc-payment-1");
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sepaStatus: "PENDING_SUBMISSION" }),
      })
    );
  });
});

describe("cancelSepaMandate", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await cancelSepaMandate(SOCIETY_ID, MANDATE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si mandat introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockResolvedValue(null);

    const result = await cancelSepaMandate(SOCIETY_ID, MANDATE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Mandat introuvable/);
  });

  it("annule le mandat avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockResolvedValue(makeMandate() as never);
    prismaMock.sepaMandate.update.mockResolvedValue({} as never);

    const result = await cancelSepaMandate(SOCIETY_ID, MANDATE_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.sepaMandate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });
});

describe("createSepaMandate – ForbiddenError et catch générique", () => {
  it("retourne ForbiddenError si rôle insuffisant (ligne 73)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, validMandateInput);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si la BDD échoue (ligne 75)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await createSepaMandate(SOCIETY_ID, TENANT_ID, validMandateInput);
    expect(result).toEqual({ success: false, error: "Erreur lors de la création du mandat SEPA" });
  });
});

describe("triggerSepaPayment – ForbiddenError et catch générique", () => {
  it("retourne ForbiddenError si rôle insuffisant (ligne 131)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si la BDD échoue (ligne 133)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await triggerSepaPayment(SOCIETY_ID, validPaymentInput);
    expect(result).toEqual({ success: false, error: "Erreur lors du déclenchement du prélèvement" });
  });
});

describe("cancelSepaMandate – ForbiddenError et catch générique", () => {
  it("retourne ForbiddenError si rôle insuffisant (ligne 171)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await cancelSepaMandate(SOCIETY_ID, MANDATE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si la BDD échoue (ligne 173)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await cancelSepaMandate(SOCIETY_ID, MANDATE_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de l'annulation du mandat" });
  });
});

describe("getSepaMandates", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getSepaMandates(SOCIETY_ID, TENANT_ID);
    expect(result).toBeNull();
  });

  it("retourne la liste des mandats si authentifié", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.sepaMandate.findMany.mockResolvedValue([makeMandate()] as never);

    const result = await getSepaMandates(SOCIETY_ID, TENANT_ID);
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({ id: MANDATE_ID, status: "ACTIVE" });
  });
});
