import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requirePortalAuth } = vi.hoisted(() => ({
  requirePortalAuth: vi.fn(),
}));

const mockDownload = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn(() => ({ download: mockDownload })));
const mockCreateClient = vi.hoisted(() => vi.fn(() => ({ storage: { from: mockFrom } })));

vi.mock("@/lib/portal-auth", () => ({ requirePortalAuth }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

import { GET } from "./route";

function getRequest() {
  return new Request("http://localhost/api/portal/quittances/archive") as never;
}

describe("GET /api/portal/quittances/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_STORAGE_BUCKET = "documents";
    requirePortalAuth.mockResolvedValue({ tenantId: "tenant-1", email: "tenant@test.fr" });
  });

  it("retourne 401 si la session portail est invalide", async () => {
    requirePortalAuth.mockRejectedValue(new Error("Acces portail non autorise"));

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
  });

  it("retourne 503 si Supabase n'est pas configure", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const response = await GET(getRequest());

    expect(response.status).toBe(503);
  });

  it("retourne un zip vide si le locataire n'a aucune quittance avec fichier", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toContain("quittances");
    expect(response.headers.get("Content-Disposition")).toContain(".zip");
  });

  it("retourne un zip avec les PDFs des quittances ayant un fileUrl", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "inv-1", invoiceNumber: "QUI-2024-001", fileUrl: "invoices/2024/QUI-001.pdf", issueDate: new Date("2024-01-01") },
      { id: "inv-2", invoiceNumber: "QUI-2024-002", fileUrl: "invoices/2024/QUI-002.pdf", issueDate: new Date("2024-02-01") },
    ] as never);
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockDownload
      .mockResolvedValueOnce({ data: new Blob([pdfBytes], { type: "application/pdf" }), error: null })
      .mockResolvedValueOnce({ data: new Blob([pdfBytes], { type: "application/pdf" }), error: null });

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("ignore les quittances dont le telechargement Supabase echoue", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "inv-1", invoiceNumber: "QUI-2024-001", fileUrl: "invoices/2024/QUI-001.pdf", issueDate: new Date("2024-01-01") },
    ] as never);
    mockDownload.mockResolvedValue({ data: null, error: new Error("not found") });

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
  });

  it("retourne 404 si le locataire n'est pas trouve (isolation securite)", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(404);
  });

  it("n'appelle pas Supabase pour les quittances sans fileUrl", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "tenant-1" } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: "inv-1", invoiceNumber: "QUI-2024-001", fileUrl: null, issueDate: new Date("2024-01-01") },
    ] as never);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
