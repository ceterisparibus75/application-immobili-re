import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";
import { PAClientError } from "@/lib/pa-client";
import { ChorusProError } from "@/lib/chorus-pro-client";
import { disconnectSocietyFromSuperPDP } from "@/lib/pa-oauth";
import { env } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

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
vi.mock("@/lib/pa-oauth", () => ({
  disconnectSocietyFromSuperPDP: vi.fn().mockResolvedValue(undefined),
  getSocietyAccessToken: vi.fn().mockResolvedValue(null),
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
  disconnectFromSuperPDP,
  getEInvoiceStatus,
  lookupDirectory,
  markInvoiceInPayment,
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
    vi.mocked(createClient).mockReset();
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

  it("déconnecte la société du SuperPDP avec succès", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const result = await disconnectFromSuperPDP(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/parametres/facturation");
  });

  it("retourne une erreur si la société n'est pas inscrite au PPF (syncReceivedInvoices)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: null } as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("inscrite");
  });

  it("marque une facture en cours de paiement (markInvoiceInPayment)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: SUPPLIER_INVOICE_ID,
      ppfInvoiceId: "flow-pay-1",
      invoiceNumber: "F-2026-099",
    } as never);
    prismaMock.supplierInvoice.update.mockResolvedValue({} as never);

    const result = await markInvoiceInPayment(SOCIETY_ID, SUPPLIER_INVOICE_ID, "2026-04-30", 1200);
    expect(result.success).toBe(true);
    expect(paClient.updateFlowStatus).toHaveBeenCalledWith(
      "flow-pay-1",
      expect.objectContaining({ status: "EN_COURS_DE_PAIEMENT", paymentAmount: 1200 })
    );
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ppfStatus: "EN_COURS_DE_PAIEMENT", status: "VALIDATED" }) })
    );
  });

  it("checkChorusProStatus retourne une erreur si la facture n'est pas Chorus Pro", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      einvoiceXmlUrl: "flow-456", // pas de préfixe "cpro:"
      invoiceNumber: "F-001",
    } as never);

    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Chorus Pro");
  });

  it("checkChorusProStatus retourne le statut d'une facture Chorus Pro valide", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const cproClient = {
      deposerFluxFacture: vi.fn(),
      consulterCR: vi.fn().mockResolvedValue({ statutCR: "INTEGREE", libelle: "Facture intégrée avec succès" }),
    };
    getChorusProClient.mockReturnValue(cproClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      einvoiceXmlUrl: "cpro:CPP-FLUX-001",
      invoiceNumber: "F-2026-042",
    } as never);

    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);

    expect(result).toEqual({
      success: true,
      data: { statut: "INTEGREE", libelle: "Facture intégrée avec succès" },
    });
    expect(cproClient.consulterCR).toHaveBeenCalledWith("CPP-FLUX-001");
  });

  it("submitInvoiceToChorusPro soumet la facture et stocke le numéro de flux", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const cproClient = {
      deposerFluxFacture: vi.fn().mockResolvedValue({ numeroFluxDepot: "CPP-2026-00042" }),
      consulterCR: vi.fn(),
    };
    getChorusProClient.mockReturnValue(cproClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-042",
      society: { name: "SCI Test" },
      tenant: { companyName: "Client Public" },
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    }));

    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);

    expect(result).toEqual({
      success: true,
      data: { numeroFluxDepot: "CPP-2026-00042" },
    });
    expect(cproClient.deposerFluxFacture).toHaveBeenCalledWith(
      expect.any(Buffer),
      "F-2026-042.pdf",
      "IN_DP_E1_FACTURX"
    );
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: {
        einvoiceXmlUrl: "cpro:CPP-2026-00042",
        einvoiceGeneratedAt: expect.any(Date),
      },
    });
    vi.unstubAllGlobals();
  });

  it("refuseInvoice refuse la facture et met à jour le statut avec le motif", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: SUPPLIER_INVOICE_ID,
      ppfInvoiceId: "flow-ref-1",
      invoiceNumber: "F-2026-005",
    } as never);

    const result = await refuseInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID, "Erreur de montant");

    expect(result).toEqual({ success: true });
    expect(paClient.updateFlowStatus).toHaveBeenCalledWith(
      "flow-ref-1",
      expect.objectContaining({ status: "REFUSEE", comment: "Erreur de montant" })
    );
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith({
      where: { id: SUPPLIER_INVOICE_ID },
      data: expect.objectContaining({
        ppfStatus: "REFUSEE",
        status: "REJECTED",
        rejectionReason: "Erreur de montant",
      }),
    });
  });

  it("syncReceivedInvoices réussit avec zéro flux retournés (aucune facture créée)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: "12345678901234",
      ppfRegisteredAt: new Date(),
    } as never);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
      searchFlows: vi.fn().mockResolvedValue({ flows: [] }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await syncReceivedInvoices(SOCIETY_ID);

    expect(result).toEqual({ success: true, data: { created: 0, updated: 0 } });
    expect(paClient.searchFlows).toHaveBeenCalledWith(
      expect.objectContaining({ siret: "12345678901234", page: 0, pageSize: 50 })
    );
  });

  it("couvre un cycle PA reçu complet : sync CII, stockage XML/PDF puis mise en paiement", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: "12345678901234",
      ppfRegisteredAt: new Date("2026-04-01T00:00:00.000Z"),
    } as never);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upload });
    vi.mocked(createClient).mockReturnValue({ storage: { from } } as never);

    const paClient = {
      lookupBySiret: vi.fn().mockResolvedValue(null),
      searchFlows: vi.fn().mockResolvedValueOnce({
        flows: [
          {
            flowId: "FLOW-CII-001",
            status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01",
            dueDate: "2026-04-30",
            invoiceNumber: "FA/2026 001",
            format: "CII",
            totalTTC: 1200,
            currency: "EUR",
            seller: { name: "Fournisseur PA", siret: "55566677700012" },
          },
        ],
      }),
      downloadFlowDocument: vi.fn()
        .mockResolvedValueOnce(Buffer.from("<cii>facture</cii>"))
        .mockResolvedValueOnce(Buffer.from("%PDF-readable")),
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: SUPPLIER_INVOICE_ID,
        ppfInvoiceId: "FLOW-CII-001",
        invoiceNumber: "FA/2026 001",
      } as never);
    prismaMock.supplierInvoice.create.mockResolvedValue({ id: SUPPLIER_INVOICE_ID } as never);
    prismaMock.supplierInvoice.update.mockResolvedValue({} as never);

    const syncResult = await syncReceivedInvoices(SOCIETY_ID);
    const paymentResult = await markInvoiceInPayment(
      SOCIETY_ID,
      SUPPLIER_INVOICE_ID,
      "2026-04-30",
      1200
    );

    expect(syncResult).toEqual({ success: true, data: { created: 1, updated: 0 } });
    expect(upload).toHaveBeenNthCalledWith(
      1,
      "supplier-invoices/society-1/2026/FA_2026_001_FLOW-CII-001.xml",
      Buffer.from("<cii>facture</cii>"),
      { contentType: "application/xml", upsert: false }
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      "supplier-invoices/society-1/2026/FA_2026_001_FLOW-CII-001.pdf",
      Buffer.from("%PDF-readable"),
      { contentType: "application/pdf", upsert: false }
    );
    expect(prismaMock.supplierInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: SOCIETY_ID,
        invoiceNumber: "FA/2026 001",
        storagePath: "supplier-invoices/society-1/2026/FA_2026_001_FLOW-CII-001.pdf",
        xmlStoragePath: "supplier-invoices/society-1/2026/FA_2026_001_FLOW-CII-001.xml",
        source: "ppf_einvoice",
        ppfInvoiceId: "FLOW-CII-001",
        ppfStatus: "MISE_A_DISPOSITION",
        status: "PENDING_REVIEW",
      }),
    });
    expect(paymentResult).toEqual({ success: true });
    expect(paClient.updateFlowStatus).toHaveBeenCalledWith(
      "FLOW-CII-001",
      expect.objectContaining({
        status: "EN_COURS_DE_PAIEMENT",
        paymentDate: "2026-04-30",
        paymentAmount: 1200,
      })
    );
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SUPPLIER_INVOICE_ID },
        data: expect.objectContaining({
          ppfStatus: "EN_COURS_DE_PAIEMENT",
          status: "VALIDATED",
        }),
      })
    );
  });

  it("getEInvoiceStatus retourne une erreur si la PA n'est pas configurée", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    isEInvoicingConfigured.mockReturnValue(false);

    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("n'est pas configurée");
  });

  it("getEInvoiceStatus retourne une erreur si la facture est introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("acknowledgeInvoice retourne une erreur si la PA n'est pas configurée", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    isEInvoicingConfigured.mockReturnValue(false);

    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("n'est pas configurée");
  });

  it("acknowledgeInvoice retourne une erreur si la facture fournisseur est introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("acknowledgeInvoice retourne une erreur si la facture n'est pas liée au PPF", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: SUPPLIER_INVOICE_ID,
      ppfInvoiceId: null,
      invoiceNumber: "F-2026-001",
    } as never);

    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("PPF");
  });

  it("lookupDirectory retourne inscrit=true avec la dénomination si l'entreprise est dans l'annuaire", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const paClient = {
      lookupBySiret: vi.fn().mockResolvedValue({
        inscritAnnuaire: true,
        denomination: "Société Test SA",
        adressesFacturation: [{ actif: true, plateforme: "CHORUS_PRO" }],
      }),
    };
    getPAClient.mockReturnValue(paClient);

    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");
    expect(result.success).toBe(true);
    expect(result.data?.inscrit).toBe(true);
    expect(result.data?.denomination).toBe("Société Test SA");
    expect(result.data?.plateforme).toBe("CHORUS_PRO");
  });

  it("registerSocietyInPPF retourne une erreur si le SIRET est absent", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: null, ppfRegisteredAt: null } as never);

    const result = await registerSocietyInPPF(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("SIRET");
  });

  it("registerSocietyInPPF retourne succès immédiatement si déjà inscrite", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: "12345678901234",
      ppfRegisteredAt: new Date(),
    } as never);

    const result = await registerSocietyInPPF(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.society.update).not.toHaveBeenCalled();
  });

  it("submitInvoiceToChorusPro retourne une erreur si la facture est introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("submitInvoiceToChorusPro retourne une erreur si la génération Factur-X échoue", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-001",
      society: { name: "SCI Test" },
      tenant: { companyName: "Client Public" },
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Factur-X");
    vi.unstubAllGlobals();
  });

  it("syncReceivedInvoices met à jour une facture existante dont le statut a changé", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: "12345678901234",
      ppfRegisteredAt: new Date(),
    } as never);
    const paClient = {
      lookupBySiret: vi.fn().mockResolvedValue(null),
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-flow-update",
            status: "RECUE",
            issueDate: "2026-04-01",
            dueDate: "2026-04-30",
            invoiceNumber: "FA-EXT-002",
            format: "FACTURX",
            totalTTC: 500,
            currency: "EUR",
            seller: { name: "Fournisseur", siret: "55566677700001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst
      .mockResolvedValueOnce(null) // lastSync
      .mockResolvedValueOnce({ id: "existing-1", ppfStatus: "MISE_A_DISPOSITION" } as never); // existing with different status
    prismaMock.supplierInvoice.update.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.updated).toBe(1);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ppfStatus: "RECUE" }) })
    );
  });

  it("syncReceivedInvoices crée une nouvelle facture fournisseur depuis un flux PPF", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({
      siret: "12345678901234",
      ppfRegisteredAt: new Date(),
    } as never);
    const paClient = {
      updateFlowStatus: vi.fn().mockResolvedValue(undefined),
      lookupBySiret: vi.fn().mockResolvedValue(null),
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-flow-99",
            status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01",
            dueDate: "2026-04-30",
            invoiceNumber: "FA-EXT-001",
            format: "FACTURX",
            totalTTC: 2400,
            currency: "EUR",
            seller: { name: "Fournisseur Externe SA", siret: "55566677700001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
    };
    getPAClient.mockReturnValue(paClient);
    // lastSync (supplierInvoice.findFirst) → null, then existing check → null
    prismaMock.supplierInvoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);

    expect(result).toEqual({ success: true, data: { created: 1, updated: 0 } });
    expect(prismaMock.supplierInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: SOCIETY_ID,
        ppfInvoiceId: "ppf-flow-99",
        ppfStatus: "MISE_A_DISPOSITION",
        invoiceNumber: "FA-EXT-001",
        amountTTC: 2400,
        supplierName: "Fournisseur Externe SA",
        status: "PENDING_REVIEW",
      }),
    });
  });
  // --- disconnectFromSuperPDP ---

  it("disconnectFromSuperPDP retourne une erreur si non authentifié (ligne 96)", async () => {
    mockUnauthenticated();
    const result = await disconnectFromSuperPDP(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("disconnectFromSuperPDP retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await disconnectFromSuperPDP(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("disconnectFromSuperPDP retourne une erreur generique si la deconnexion echoue", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    vi.mocked(disconnectSocietyFromSuperPDP).mockRejectedValueOnce(new Error("Connection error"));
    const result = await disconnectFromSuperPDP(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("connexion");
  });

  // --- syncReceivedInvoices ---

  it("syncReceivedInvoices retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("syncReceivedInvoices retourne une erreur generique si la BDD echoue", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("synchronisation");
  });

  it("syncReceivedInvoices cree une facture fournisseur en passant par supabase (format CII)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockStorage = { from: vi.fn().mockReturnValue({ upload: mockUpload }) };
    vi.mocked(createClient).mockReturnValue({ storage: mockStorage } as never);

    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-cii-1", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-CII-001", format: "CII",
            totalTTC: 500, currency: "EUR",
            seller: { name: "Fournisseur CII", siret: "11122233300001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn().mockResolvedValue(Buffer.from("xml-data")),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
    expect(paClient.downloadFlowDocument).toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalled();
  });

  it("syncReceivedInvoices cree une facture fournisseur format FACTURX (non-XML avec supabase)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockStorage = { from: vi.fn().mockReturnValue({ upload: mockUpload }) };
    vi.mocked(createClient).mockReturnValue({ storage: mockStorage } as never);

    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-fx-1", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-FX-001", format: "FACTURX",
            totalTTC: 300, currency: "EUR",
            seller: { name: "Fournisseur FX", siret: "22233344400001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn().mockResolvedValue(Buffer.from("pdf-data")),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
  });

  // --- submitInvoice ---

  it("submitInvoice retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("submitInvoice retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("submitInvoice retourne une erreur si PA non configuree (ligne 294)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    isEInvoicingConfigured.mockReturnValue(false);
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("n'est pas");
  });

  it("submitInvoice retourne une erreur si facture introuvable (ligne 305)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("submitInvoice retourne une erreur si SIRET manquant (ligne 308)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, invoiceNumber: "F-001", society: { siret: null },
      tenant: { entityType: "PERSONNE_MORALE", siret: null, companyName: "Test" },
    } as never);
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("SIRET");
  });

  it("submitInvoice retourne une erreur PAClientError", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, invoiceNumber: "F-001", invoiceType: "LOYER",
      issueDate: new Date("2026-04-01"), dueDate: new Date("2026-04-30"),
      periodStart: null, periodEnd: null, totalHT: 1000, totalVAT: 0, totalTTC: 1000,
      society: {
        name: "SCI", addressLine1: "1 rue", postalCode: "75001", city: "Paris",
        country: "FR", vatNumber: null, email: "a@a.fr", siret: "12345678901234",
      },
      tenant: {
        entityType: "PERSONNE_MORALE", siret: "98765432100011",
        companyName: "Buyer Corp", firstName: null, lastName: null,
        companyAddress: "10 av", personalAddress: null,
      },
      lines: [{ label: "Loyer", totalHT: 1000, vatRate: 0, totalTTC: 1000 }],
      lease: null,
    } as never);
    getPAClient.mockReturnValue({
      submitInvoice: vi.fn().mockRejectedValue(new PAClientError(500, "/api", "error")),
    });
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Erreur PA");
  });

  it("submitInvoice retourne une erreur generique", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  // --- getEInvoiceStatus ---

  it("getEInvoiceStatus retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("getEInvoiceStatus retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("getEInvoiceStatus retourne une erreur PAClientError", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({ einvoiceXmlUrl: "flow-abc" } as never);
    getPAClient.mockReturnValue({
      getFlowStatuses: vi.fn().mockRejectedValue(new PAClientError(500, "/api", "error")),
    });
    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Erreur PA");
  });

  it("getEInvoiceStatus retourne une erreur generique", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await getEInvoiceStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  // --- _updateFlowStatus (via acknowledgeInvoice) ---

  it("acknowledgeInvoice retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("acknowledgeInvoice retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("acknowledgeInvoice retourne une erreur PAClientError", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: SUPPLIER_INVOICE_ID, ppfInvoiceId: "flow-123", invoiceNumber: "F-001",
    } as never);
    getPAClient.mockReturnValue({
      updateFlowStatus: vi.fn().mockRejectedValue(new PAClientError(500, "/api", "error")),
    });
    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Erreur PA");
  });

  it("acknowledgeInvoice retourne une erreur generique", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.supplierInvoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await acknowledgeInvoice(SOCIETY_ID, SUPPLIER_INVOICE_ID);
    expect(result.success).toBe(false);
  });

  // --- lookupDirectory ---

  it("lookupDirectory retourne une erreur si PA non configuree (ligne 588)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    isEInvoicingConfigured.mockReturnValue(false);
    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");
    expect(result.success).toBe(false);
  });

  it("lookupDirectory retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");
    expect(result.success).toBe(false);
  });

  it("lookupDirectory retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");
    expect(result.success).toBe(false);
  });

  it("lookupDirectory retourne une erreur PAClientError", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    getPAClient.mockReturnValue({
      lookupBySiret: vi.fn().mockRejectedValue(new PAClientError(500, "/api", "error")),
    });
    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Erreur PA");
  });

  it("lookupDirectory retourne une erreur generique", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    getPAClient.mockReturnValue({
      lookupBySiret: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    const result = await lookupDirectory(SOCIETY_ID, "12345678901234");
    expect(result.success).toBe(false);
  });

  // --- registerSocietyInPPF ---

  it("registerSocietyInPPF retourne une erreur si PA non configuree (ligne 631)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    isEInvoicingConfigured.mockReturnValue(false);
    const result = await registerSocietyInPPF(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("registerSocietyInPPF retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await registerSocietyInPPF(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("registerSocietyInPPF retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await registerSocietyInPPF(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("registerSocietyInPPF mode A inscrit si l'entreprise est dans l'annuaire (lignes 654-664)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const saved = (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"];
    (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"] = undefined;
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: null } as never);
    getPAClient.mockReturnValue({ lookupBySiret: vi.fn().mockResolvedValue({ inscritAnnuaire: true }) });
    prismaMock.society.update.mockResolvedValue({} as never);
    try {
      const result = await registerSocietyInPPF(SOCIETY_ID);
      expect(result.success).toBe(true);
    } finally {
      (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"] = saved;
    }
  });

  it("registerSocietyInPPF mode A retourne une erreur si non inscrit dans l'annuaire (ligne 657-661)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const saved = (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"];
    (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"] = undefined;
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: null } as never);
    getPAClient.mockReturnValue({ lookupBySiret: vi.fn().mockResolvedValue({ inscritAnnuaire: false }) });
    try {
      const result = await registerSocietyInPPF(SOCIETY_ID);
      expect(result.success).toBe(false);
      expect(result.error).toContain("visible");
    } finally {
      (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"] = saved;
    }
  });

  it("registerSocietyInPPF mode A retourne une erreur PAClientError (lignes 684-685)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const saved = (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"];
    (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"] = undefined;
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: null } as never);
    getPAClient.mockReturnValue({ lookupBySiret: vi.fn().mockRejectedValue(new PAClientError(500, "/api", "error")) });
    try {
      const result = await registerSocietyInPPF(SOCIETY_ID);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Erreur PA");
    } finally {
      (env as never as Record<string, unknown>)["PA_MANDATAIRE_SIRET"] = saved;
    }
  });

  it("registerSocietyInPPF retourne une erreur generique si la BDD echoue (lignes 686-687)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.society.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await registerSocietyInPPF(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  // --- submitInvoiceToChorusPro ---

  it("submitInvoiceToChorusPro retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("submitInvoiceToChorusPro retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("submitInvoiceToChorusPro retourne une erreur ChorusProError (lignes 760-761)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID, invoiceNumber: "F-001",
      society: { name: "SCI" }, tenant: { companyName: "Client" },
    } as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    }));
    getChorusProClient.mockReturnValue({
      deposerFluxFacture: vi.fn().mockRejectedValue(new ChorusProError(500, "error", "/api")),
      consulterCR: vi.fn(),
    });
    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Chorus Pro");
    vi.unstubAllGlobals();
  });

  it("submitInvoiceToChorusPro retourne une erreur generique (lignes 762-763)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await submitInvoiceToChorusPro(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  // --- checkChorusProStatus ---

  it("checkChorusProStatus retourne une erreur si facture introuvable (ligne 785)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("checkChorusProStatus retourne une erreur si non authentifie", async () => {
    mockUnauthenticated();
    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("checkChorusProStatus retourne une erreur si role insuffisant (ForbiddenError)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.userSociety.findUnique.mockResolvedValue(null as never);
    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  it("checkChorusProStatus retourne une erreur ChorusProError (lignes 805-806)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockResolvedValue({
      einvoiceXmlUrl: "cpro:CPP-001", invoiceNumber: "F-001",
    } as never);
    getChorusProClient.mockReturnValue({
      deposerFluxFacture: vi.fn(),
      consulterCR: vi.fn().mockRejectedValue(new ChorusProError(500, "error", "/api")),
    });
    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Chorus Pro");
  });

  it("checkChorusProStatus retourne une erreur generique (lignes 807-808)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.invoice.findFirst.mockRejectedValue(new Error("DB crash"));
    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(false);
  });

  // --- checkChorusProStatus — statutCR null (B95 arm1) ---

  it("checkChorusProStatus utilise 'EN_COURS' si statutCR est absent (B95 arm1)", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const cproClient = {
      deposerFluxFacture: vi.fn(),
      consulterCR: vi.fn().mockResolvedValue({ libelle: "En traitement" }), // no statutCR
    };
    getChorusProClient.mockReturnValue(cproClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      einvoiceXmlUrl: "cpro:CPP-NULL-001",
      invoiceNumber: "F-2026-null",
    } as never);

    const result = await checkChorusProStatus(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    expect(result.data?.statut).toBe("EN_COURS");
  });

  // --- submitInvoice — PERSONNE_PHYSIQUE (B37-B44, B50-B51) ---

  it("submitInvoice construit le nom via firstName/lastName pour PERSONNE_PHYSIQUE avec noms null (B37/B39-B43/B44/B50/B51 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      submitInvoice: vi.fn().mockResolvedValue({ flowId: "flow-physique-null" }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-phys",
      invoiceType: "LOYER",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-10"),
      periodStart: null, periodEnd: null,
      totalHT: 900, totalVAT: 0, totalTTC: 900,
      society: {
        name: "SCI Atlas", addressLine1: "1 rue", postalCode: "75001",
        city: "Paris", country: "FR", vatNumber: null,
        email: "a@b.fr", siret: "12345678901234",
      },
      tenant: {
        entityType: "PERSONNE_PHYSIQUE",
        siret: null, companyName: null,
        firstName: null, lastName: null,
        companyAddress: null, personalAddress: null,
      },
      lines: [{ label: "Loyer", totalHT: 900, vatRate: 0, totalTTC: 900 }],
      lease: null,
    } as never);

    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    // tenantName = "---" (both null), tenantSiret = undefined → buyer.siren = "000000000"
    expect(paClient.submitInvoice).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ buyer: expect.objectContaining({ siren: "000000000" }) }),
      undefined
    );
  });

  it("submitInvoice construit le nom via firstName/lastName pour PERSONNE_PHYSIQUE avec vrais noms (B41/B42/B43 arm0)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      submitInvoice: vi.fn().mockResolvedValue({ flowId: "flow-physique-name" }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-phys2",
      invoiceType: "LOYER",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-10"),
      periodStart: null, periodEnd: null,
      totalHT: 800, totalVAT: 0, totalTTC: 800,
      society: {
        name: "SCI Atlas", addressLine1: "1 rue", postalCode: "75001",
        city: "Paris", country: "FR", vatNumber: null,
        email: "a@b.fr", siret: "12345678901234",
      },
      tenant: {
        entityType: "PERSONNE_PHYSIQUE",
        siret: null, companyName: null,
        firstName: "Jean", lastName: "Dupont",
        companyAddress: null, personalAddress: "5 rue du Parc",
      },
      lines: [{ label: "Loyer", totalHT: 800, vatRate: 0, totalTTC: 800 }],
      lease: null,
    } as never);

    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
  });

  it("submitInvoice utilise '---' si companyName est null pour PERSONNE_MORALE (B38/B40 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      submitInvoice: vi.fn().mockResolvedValue({ flowId: "flow-morale-null" }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-morale-null",
      invoiceType: "LOYER",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-10"),
      periodStart: null, periodEnd: null,
      totalHT: 700, totalVAT: 0, totalTTC: 700,
      society: {
        name: "SCI Atlas", addressLine1: "1 rue", postalCode: "75001",
        city: "Paris", country: "FR", vatNumber: null,
        email: "a@b.fr", siret: "12345678901234",
      },
      tenant: {
        entityType: "PERSONNE_MORALE",
        siret: null, companyName: null, // siret null → tenantSiret=undefined (B38 arm1)
        firstName: null, lastName: null,
        companyAddress: null, personalAddress: null,
      },
      lines: [{ label: "Loyer", totalHT: 700, vatRate: 0, totalTTC: 700 }],
      lease: null,
    } as never);

    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
    // tenantName = "---" (companyName null), tenantSiret = undefined → siren = "000000000"
    expect(paClient.submitInvoice).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ buyer: expect.objectContaining({ siren: "000000000", siret: undefined }) }),
      undefined
    );
  });

  it("submitInvoice gère un email de société null (B48 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    const paClient = {
      submitInvoice: vi.fn().mockResolvedValue({ flowId: "flow-no-email" }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      invoiceNumber: "F-2026-noemail",
      invoiceType: "LOYER",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-10"),
      periodStart: null, periodEnd: null,
      totalHT: 600, totalVAT: 0, totalTTC: 600,
      society: {
        name: "SCI B", addressLine1: "2 rue", postalCode: "75002",
        city: "Paris", country: "FR", vatNumber: null,
        email: null, // email null → B48 arm1
        siret: "12345678901234",
      },
      tenant: {
        entityType: "PERSONNE_MORALE", siret: "98765432100011",
        companyName: "Buyer", firstName: null, lastName: null,
        companyAddress: "10 av", personalAddress: null,
      },
      lines: [{ label: "Loyer", totalHT: 600, vatRate: 0, totalTTC: 600 }],
      lease: null,
    } as never);

    const result = await submitInvoice(SOCIETY_ID, INVOICE_ID);
    expect(result.success).toBe(true);
  });

  // --- syncReceivedInvoices — branches restantes ---

  it("syncReceivedInvoices traite des flows undefined (B12 arm1 — flows ?? [])", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);
    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({}) // flows undefined → [] via ?? (B12 arm1)
        .mockResolvedValueOnce({ flows: [] }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(0);
  });

  it("syncReceivedInvoices ne met pas à jour si le statut PPF est identique (B15 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);
    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-same-status", status: "RECUE",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-SAME-001", format: "FACTURX",
            totalTTC: 500, currency: "EUR",
            seller: { name: "Fournisseur", siret: "55566677700001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-1", ppfStatus: "RECUE" } as never); // same status → no update

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.updated).toBe(0);
    expect(prismaMock.supplierInvoice.update).not.toHaveBeenCalled();
  });

  it("syncReceivedInvoices continue la pagination si 50 flux retournés (B13 arm1 — hasMore stays true)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);
    const baseFlow = {
      flowId: "ppf-bulk", status: "MISE_A_DISPOSITION",
      issueDate: "2026-04-01", dueDate: "2026-04-30",
      invoiceNumber: "FA-BULK", format: "FACTURX",
      totalTTC: 100, currency: "EUR",
      seller: { name: "Bulk Corp", siret: "11100000000001" },
    };
    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({ flows: Array(50).fill(baseFlow).map((f, i) => ({ ...f, flowId: `ppf-bulk-${i}` })) })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn().mockResolvedValue(null), // supabase may be non-null from prior test
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(paClient.searchFlows).toHaveBeenCalledTimes(2); // second call because hasMore stayed true
  });

  it("syncReceivedInvoices utilise PENDING_REVIEW pour un statut PPF non mappé (B16 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);
    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-unknown", status: "STATUT_INCONNU",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-UNK-001", format: "FACTURX",
            totalTTC: 100, currency: "EUR",
            seller: { name: "Inconnu", siret: "99900000000001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-unk", ppfStatus: "MISE_A_DISPOSITION" } as never); // different status → update

    prismaMock.supplierInvoice.update.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING_REVIEW" }) })
    );
  });

  it("syncReceivedInvoices crée une facture avec dueDate/currency/seller.siret null (B27/B28/B29 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);
    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-null-fields", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01",
            dueDate: null,   // B27 arm1
            currency: null,  // B28 arm1
            invoiceNumber: "FA-NULL-001", format: "FACTURX",
            totalTTC: 100,
            seller: { name: "Vendeur", siret: null }, // B29 arm1
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn().mockResolvedValue(null), // supabase may be non-null from prior test
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.supplierInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dueDate: null,
          currency: "EUR",  // fallback
          supplierSiret: null,
        }),
      })
    );
  });

  it("syncReceivedInvoices saute l'upload si docBuffer est null (B18 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockStorage = { from: vi.fn().mockReturnValue({ upload: mockUpload }) };
    vi.mocked(createClient).mockReturnValue({ storage: mockStorage } as never);

    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-no-doc", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-NODOC-001", format: "CII",
            totalTTC: 100, currency: "EUR",
            seller: { name: "Vendeur", siret: "11122233300001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn().mockResolvedValue(null), // null docBuffer → B18 arm1
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled(); // upload skipped
  });

  it("syncReceivedInvoices continue si l'upload du document original échoue (B22 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const mockUpload = vi.fn().mockResolvedValue({ error: new Error("upload failed") }); // B22 arm1
    const mockStorage = { from: vi.fn().mockReturnValue({ upload: mockUpload }) };
    vi.mocked(createClient).mockReturnValue({ storage: mockStorage } as never);

    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-upload-fail", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-UFAIL-001", format: "FACTURX",
            totalTTC: 100, currency: "EUR",
            seller: { name: "Vendeur", siret: "11122233300001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn().mockResolvedValue(Buffer.from("pdf-data")), // non-null docBuffer
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1); // created despite upload failure
  });

  it("syncReceivedInvoices saute l'upload PDF lisible si pdfBuffer est null (B25 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockStorage = { from: vi.fn().mockReturnValue({ upload: mockUpload }) };
    vi.mocked(createClient).mockReturnValue({ storage: mockStorage } as never);

    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-no-pdf", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-NOPDF-001", format: "CII", // non-FACTURX → downloads readable view
            totalTTC: 100, currency: "EUR",
            seller: { name: "Vendeur", siret: "11122233300001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn()
        .mockResolvedValueOnce(Buffer.from("xml-data")) // original CII
        .mockResolvedValueOnce(null), // readable view null → B25 arm1
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  it("syncReceivedInvoices continue si l'upload du PDF lisible échoue (B26 arm1)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const mockUpload = vi.fn()
      .mockResolvedValueOnce({ error: null })         // original CII upload ok
      .mockResolvedValueOnce({ error: new Error("pdf fail") }); // readable view upload fails → B26 arm1
    const mockStorage = { from: vi.fn().mockReturnValue({ upload: mockUpload }) };
    vi.mocked(createClient).mockReturnValue({ storage: mockStorage } as never);

    const paClient = {
      searchFlows: vi.fn()
        .mockResolvedValueOnce({
          flows: [{
            flowId: "ppf-pdf-fail", status: "MISE_A_DISPOSITION",
            issueDate: "2026-04-01", dueDate: "2026-04-30",
            invoiceNumber: "FA-PDFFAIL-001", format: "UBL",
            totalTTC: 100, currency: "EUR",
            seller: { name: "Vendeur", siret: "11122233300001" },
          }],
        })
        .mockResolvedValueOnce({ flows: [] }),
      downloadFlowDocument: vi.fn()
        .mockResolvedValueOnce(Buffer.from("ubl-data"))
        .mockResolvedValueOnce(Buffer.from("readable-pdf")),
    };
    getPAClient.mockReturnValue(paClient);
    prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
    prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

    const result = await syncReceivedInvoices(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(1);
  });

  // --- getSupabase null (B0 arm0) ---

  it("_syncForSociety saute l'upload supabase si la clé supabase est absente (B0 arm0)", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.society.findFirst.mockResolvedValue({ siret: "12345678901234", ppfRegisteredAt: new Date() } as never);

    const saved = (env as never as Record<string, unknown>)["SUPABASE_SERVICE_ROLE_KEY"];
    (env as never as Record<string, unknown>)["SUPABASE_SERVICE_ROLE_KEY"] = undefined;

    try {
      const paClient = {
        searchFlows: vi.fn()
          .mockResolvedValueOnce({
            flows: [{
              flowId: "ppf-no-supa", status: "MISE_A_DISPOSITION",
              issueDate: "2026-04-01", dueDate: "2026-04-30",
              invoiceNumber: "FA-NOSUPA-001", format: "FACTURX",
              totalTTC: 100, currency: "EUR",
              seller: { name: "Vendeur", siret: "11122233300001" },
            }],
          })
          .mockResolvedValueOnce({ flows: [] }),
      };
      getPAClient.mockReturnValue(paClient);
      prismaMock.supplierInvoice.findFirst.mockResolvedValue(null);
      prismaMock.supplierInvoice.create.mockResolvedValue({} as never);

      const result = await syncReceivedInvoices(SOCIETY_ID);
      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1); // created without supabase upload
    } finally {
      (env as never as Record<string, unknown>)["SUPABASE_SERVICE_ROLE_KEY"] = saved;
    }
  });

});
