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
});
