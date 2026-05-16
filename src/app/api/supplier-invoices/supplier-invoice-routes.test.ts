// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, createClient, analyzeSupplierInvoice } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createClient: vi.fn(),
  analyzeSupplierInvoice: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/supplier-invoice-ai", () => ({ analyzeSupplierInvoice }));

import { POST as uploadRoute } from "./upload/route";
import { POST as analyzeRoute } from "./[id]/analyze/route";

function uploadRequest(file: File) {
  const form = new FormData();
  form.append("file", file);
  return new Request("http://localhost/api/supplier-invoices/upload", {
    method: "POST",
    body: form,
  }) as never;
}

describe("supplier invoice routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_STORAGE_BUCKET = "documents";
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
      role: "GESTIONNAIRE",
    });
  });

  it("rejette un PDF fournisseur déclaré dont les magic bytes ne correspondent pas", async () => {
    const response = await uploadRoute(
      uploadRequest(new File([new TextEncoder().encode("not a pdf")], "facture.pdf", { type: "application/pdf" }))
    );

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("échoue proprement si le stockage manque pour l'analyse IA", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    prismaMock.supplierInvoice.findUnique.mockResolvedValue({
      id: "inv-1",
      societyId: "soc-1",
      storagePath: "documents/soc-1/supplier-invoices/inv.pdf",
      mimeType: "application/pdf",
      supplierName: null,
      amountTTC: null,
    } as never);

    const response = await analyzeRoute(
      new Request("http://localhost/api/supplier-invoices/inv-1/analyze", {
        method: "POST",
        headers: { "x-society-id": "soc-1" },
      }) as never,
      { params: Promise.resolve({ id: "inv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Stockage non configuré");
    expect(analyzeSupplierInvoice).not.toHaveBeenCalled();
  });

  it("utilise la société active de session quand le header x-society-id n'est pas injecté", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    prismaMock.supplierInvoice.findUnique.mockResolvedValue({
      id: "inv-1",
      societyId: "soc-1",
      storagePath: "documents/soc-1/supplier-invoices/inv.pdf",
      mimeType: "application/pdf",
      supplierName: null,
      amountTTC: null,
    } as never);

    const response = await analyzeRoute(
      new Request("http://localhost/api/supplier-invoices/inv-1/analyze", { method: "POST" }) as never,
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(503);
    expect(requireActiveSocietyRouteContext).toHaveBeenCalledWith();
  });

  it("marque l'analyse en erreur si l'IA ne retourne aucune donnée exploitable", async () => {
    prismaMock.supplierInvoice.findUnique.mockResolvedValue({
      id: "inv-1",
      societyId: "soc-1",
      storagePath: "supplier-invoices/inv.pdf",
      mimeType: "application/pdf",
      supplierName: null,
      amountTTC: null,
    } as never);
    const download = vi.fn().mockResolvedValue({
      data: new Blob([new TextEncoder().encode("%PDF-1.7")], { type: "application/pdf" }),
      error: null,
    });
    createClient.mockReturnValue({ storage: { from: vi.fn(() => ({ download })) } });
    analyzeSupplierInvoice.mockResolvedValue({
      supplierName: null,
      supplierSiret: null,
      supplierAddress: null,
      supplierIban: null,
      supplierBic: null,
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      amountHT: null,
      amountVAT: null,
      amountTTC: null,
      vatRate: null,
      currency: "EUR",
      description: null,
      periodStart: null,
      periodEnd: null,
      confidence: 0,
    });

    const response = await analyzeRoute(
      new Request("http://localhost/api/supplier-invoices/inv-1/analyze", {
        method: "POST",
        headers: { "x-society-id": "soc-1" },
      }) as never,
      { params: Promise.resolve({ id: "inv-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("Analyse IA sans données exploitables");
    expect(prismaMock.supplierInvoice.update).toHaveBeenLastCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        aiStatus: "error",
        aiConfidence: 0,
      }),
    });
  });

  it("réutilise une affectation fournisseur historique non ambiguë après analyse IA", async () => {
    prismaMock.supplierInvoice.findUnique.mockResolvedValue({
      id: "inv-1",
      societyId: "soc-1",
      storagePath: "supplier-invoices/inv.pdf",
      mimeType: "application/pdf",
      supplierName: null,
      amountTTC: null,
    } as never);
    const download = vi.fn().mockResolvedValue({
      data: new Blob([new TextEncoder().encode("%PDF-1.7")], { type: "application/pdf" }),
      error: null,
    });
    createClient.mockReturnValue({ storage: { from: vi.fn(() => ({ download })) } });
    analyzeSupplierInvoice.mockResolvedValue({
      supplierName: "SQUARE HABITAT NORD DE FRANCE",
      supplierSiret: null,
      supplierAddress: null,
      supplierIban: null,
      supplierBic: null,
      invoiceNumber: "S.7071.00001",
      invoiceDate: "2026-01-01",
      dueDate: null,
      amountHT: null,
      amountVAT: null,
      amountTTC: 2502.66,
      vatRate: null,
      currency: "EUR",
      description: "Appel de provisions Bureaux Bollaert",
      periodStart: null,
      periodEnd: null,
      confidence: 0.69,
    });
    prismaMock.supplierInvoice.findMany.mockResolvedValue([
      {
        buildingId: "building-lens",
        categoryId: "cat-copro",
        accountingAccountId: "account-614",
      },
    ] as never);

    const response = await analyzeRoute(
      new Request("http://localhost/api/supplier-invoices/inv-1/analyze", {
        method: "POST",
        headers: { "x-society-id": "soc-1" },
      }) as never,
      { params: Promise.resolve({ id: "inv-1" }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.supplierInvoice.update).toHaveBeenLastCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        supplierName: "SQUARE HABITAT NORD DE FRANCE",
        buildingId: "building-lens",
        categoryId: "cat-copro",
        accountingAccountId: "account-614",
      }),
    });
  });
});
