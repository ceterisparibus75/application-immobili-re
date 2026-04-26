import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, createAuditLog, createClient } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createAuditLog: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({
  requireActiveSocietyRouteContext,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog,
}));

vi.mock("@/lib/env", () => ({ env: process.env }));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

import { POST as registerDocument } from "./register/route";
import { POST as createTusUpload } from "../storage/tus-create/route";

const SOCIETY_CONTEXT = {
  societyId: "society-1",
  userId: "user-1",
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("document upload route security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(120);
    process.env.SUPABASE_STORAGE_BUCKET = "documents";
    process.env.AUTH_URL = "http://localhost:3000";
    process.env.CRON_SECRET = "test-cron";

    requireActiveSocietyRouteContext.mockResolvedValue(SOCIETY_CONTEXT);
    createAuditLog.mockResolvedValue(undefined);
    createClient.mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://signed.example/document.pdf" },
          }),
        }),
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { Location: "/storage/v1/upload/resumable/abc123" },
      })
    );
  });

  it("refuse une session TUS avec extension incoherente", async () => {
    const response = await createTusUpload(
      jsonRequest("http://localhost/api/storage/tus-create", {
        filename: "payload.exe",
        mimeType: "application/pdf",
        fileSize: 1024,
        entityFolder: "general",
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("L'extension du fichier ne correspond pas au type déclaré");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("refuse une session TUS avec dossier de destination traversant", async () => {
    const response = await createTusUpload(
      jsonRequest("http://localhost/api/storage/tus-create", {
        filename: "bail.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        entityFolder: "../../secret",
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Dossier cible invalide");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("refuse l'enregistrement d'un document hors societe active", async () => {
    const response = await registerDocument(
      jsonRequest("http://localhost/api/documents/register", {
        fileName: "bail.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        storagePath: "documents/other-society/general/1_bail.pdf",
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Chemin de stockage invalide");
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it("enregistre un document TUS valide avec le MIME normalise", async () => {
    prismaMock.document.create.mockResolvedValue({ id: "doc-1" } as never);

    const response = await registerDocument(
      jsonRequest("http://localhost/api/documents/register", {
        fileName: "bail.pdf",
        fileSize: 1024,
        mimeType: "Application/PDF",
        storagePath: "documents/society-1/general/1_bail.pdf",
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document.id).toBe("doc-1");
    expect(prismaMock.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: "application/pdf",
          aiStatus: "pending",
          societyId: "society-1",
        }),
      })
    );
  });
});
