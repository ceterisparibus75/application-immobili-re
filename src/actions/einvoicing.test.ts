import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const {
  revalidatePath,
  isEInvoicingConfigured,
  isChorusProConfigured,
  getPAClient,
  getChorusProClient,
  generateFacturXml,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  isEInvoicingConfigured: vi.fn(),
  isChorusProConfigured: vi.fn(),
  getPAClient: vi.fn(),
  getChorusProClient: vi.fn(),
  generateFacturXml: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/pa-client", () => ({
  PAClientError: class PAClientError extends Error {
    status = 500;
    body = "boom";
  },
  getPAClient,
  isEInvoicingConfigured,
}));
vi.mock("@/lib/chorus-pro-client", () => ({
  ChorusProError: class ChorusProError extends Error {
    codeRetour = "ERR";
    libelle = "boom";
  },
  getChorusProClient,
  isChorusProConfigured,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/einvoice-generator", () => ({
  generateFacturXml,
}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    AUTH_URL: "https://app.test",
    PA_MANDATAIRE_SIRET: "12345678900011",
  },
}));

import {
  acknowledgeInvoice,
  checkChorusProStatus,
  getEInvoiceStatus,
  lookupDirectory,
  refuseInvoice,
  registerSocietyInPPF,
  submitInvoice,
  submitInvoiceToChorusPro,
  syncReceivedInvoices,
} from "./einvoicing";

const SOCIETY_ID = "society-1";
const INVOICE_ID = "invoice-1";
const SUPPLIER_INVOICE_ID = "supplier-invoice-1";

describe("einvoicing actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEInvoicingConfigured.mockReturnValue(true);
    isChorusProConfigured.mockReturnValue(true);
    getPAClient.mockReturnValue({
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
    });
    generateFacturXml.mockResolvedValue("<Invoice />");
    getChorusProClient.mockReturnValue({
      deposerFluxFacture: vi.fn(),
      consulterCR: vi.fn(),
    });
  });

  it("retourne une erreur si la synchronisation des factures reçues est non authentifiée", async () => {
    mockUnauthenticated();

    const result = await syncReceivedInvoices(SOCIETY_ID);

    expect(result).toEqual({
      success: false,
      error: "Non authentifié",
    });
  });

  it("retourne l'erreur de configuration B2B si la PA n'est pas configurée", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    isEInvoicingConfigured.mockReturnValue(false);

    const result = await syncReceivedInvoices(SOCIETY_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("n'est pas configurée");
  });

  it("refuse la synchronisation si le SIRET de la société est absent", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: null,
      ppfRegisteredAt: new Date(),
    } as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);

    expect(result).toEqual({
      success: false,
      error: "Le SIRET de la société est requis pour la facturation électronique.",
    });
  });

  it("retourne une erreur si une facture n'a pas encore été transmise à la PA", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      einvoiceXmlUrl: null,
    } as never);

    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);

    expect(result).toEqual({
      success: false,
      error: "Cette facture n'a pas encore été transmise à la PA",
    });
  });

  it("soumet une facture client à la PA et stocke le flowId", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
      submitInvoice: vi.fn().mockResolvedValue({ flowId: "flow-456" }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-010",
      invoiceType: "LOYER",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-10"),
      periodStart: null,
      periodEnd: null,
      totalHT: 1000,
      totalVAT: 0,
      totalTTC: 1000,
      society: {
        name: "SCI Atlas",
        addressLine1: "1 rue de Lyon",
        postalCode: "69001",
        city: "Lyon",
        country: "France",
        vatNumber: null,
        email: "contact@atlas.test",
        siret: "12345678901234",
      },
      tenant: {
        entityType: "PERSONNE_MORALE",
        siret: "98765432100011",
        companyName: "Tenant Corp",
        firstName: null,
        lastName: null,
        companyAddress: "10 avenue République",
        personalAddress: null,
      },
      lines: [
        {
          label: "Loyer avril",
          totalHT: 1000,
          vatRate: 0,
          totalTTC: 1000,
        },
      ],
      lease: null,
    } as never);

    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);

    expect(result).toEqual({
      success: true,
      data: { flowId: "flow-456" },
    });
    expect(generateFacturXml).toHaveBeenCalled();
    expect(paClient.submitInvoice).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        invoiceNumber: "F-2026-010",
        seller: {
          siren: "123456789",
          siret: "12345678901234",
          name: "SCI Atlas",
        },
        buyer: {
          siren: "987654321",
          siret: "98765432100011",
          name: "Tenant Corp",
        },
        format: "CII",
      }),
      undefined // token OAuth par société (null → undefined si non connectée)
    );
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: {
        einvoiceXmlUrl: "flow-456",
        einvoiceGeneratedAt: expect.any(Date),
      },
    });
  });

  it("retourne le statut courant d'une facture déjà transmise à la PA", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
      getFlowStatuses: vi.fn().mockResolvedValue({ currentStatus: "RECUE" }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      einvoiceXmlUrl: "flow-789",
    } as never);

    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);

    expect(result).toEqual({
      success: true,
      data: { currentStatus: "RECUE", flowId: "flow-789" },
    });
    expect(paClient.getFlowStatuses).toHaveBeenCalledWith("flow-789");
  });

  it("exige un motif explicite pour refuser une facture reçue", async () => {
    const result = await refuseInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID, " ");

    expect(result).toEqual({
      success: false,
      error: "Le motif de refus est obligatoire",
    });
  });

  it("accuse réception d'une facture reçue et met à jour son statut PPF", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: SUPPLIER_INVOICE_ID,
      ppfInvoiceId: "flow-123",
      invoiceNumber: "F-2026-001",
    } as never);

    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);

    expect(result).toEqual({ success: true });
    expect(paClient.updateFlowStatus).toHaveBeenCalledWith(
      "flow-123",
      expect.objectContaining({ status: "RECUE" })
    );
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith({
      where: { id: SUPPLIER_INVOICE_ID },
      data: {
        ppfStatus: "RECUE",
        ppfSyncedAt: expect.any(Date),
        status: "PENDING_REVIEW",
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "UPDATE",
      entity: "SupplierInvoice",
      entityId: SUPPLIER_INVOICE_ID,
      details: { invoiceNumber: "F-2026-001", ppfStatus: "RECUE" },
    });
  });

  it("retourne inscrit=false si l'entreprise est absente de l'annuaire PPF", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
    };
    getPAClient.mockReturnValue(paClient);

    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");

    expect(result).toEqual({
      success: true,
      data: { inscrit: false },
    });
  });

  it("marque la société comme inscrite au PPF en mode mandataire", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: "12345678901234",
      ppfRegisteredAt: null,
    } as never);

    const result = await registerSocietyInPPF(SOCIETY_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.society.update).toHaveBeenCalledWith({
      where: { id: SOCIETY_ID },
      data: { ppfRegisteredAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/parametres/facturation");
  });

  it("retourne l'erreur de configuration Chorus Pro si le connecteur public n'est pas configuré", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    isChorusProConfigured.mockReturnValue(false);

    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    const statusResult = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Chorus Pro n'est pas configuré");
    expect(statusResult.success).toBe(false);
    expect(statusResult.error).toContain("Chorus Pro n'est pas configuré");
  });
});
