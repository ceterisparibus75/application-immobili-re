import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext, analyzeDocument, chatWithDocument } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  analyzeDocument: vi.fn(),
  chatWithDocument: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/document-ai", () => ({ analyzeDocument, chatWithDocument }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { POST as analyzeRoute } from "./analyze/route";
import { POST as chatRoute } from "./chat/route";

const params = { params: Promise.resolve({ id: "doc-1" }) };

describe("document AI routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
      role: "GESTIONNAIRE",
    });
    prismaMock.document.findFirst.mockResolvedValue({
      id: "doc-1",
      storagePath: "documents/soc-1/general/doc.pdf",
      mimeType: "application/pdf",
      category: "bail",
      aiStatus: "pending",
    } as never);
    prismaMock.document.update.mockResolvedValue({} as never);
  });

  it("retourne 500 sans configuration Supabase pour l'analyse", async () => {
    const response = await analyzeRoute(
      new Request("http://localhost/api/documents/doc-1/analyze", { method: "POST" }) as never,
      params
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Stockage non configuré");
    expect(analyzeDocument).not.toHaveBeenCalled();
  });

  it("retourne 500 sans configuration Supabase pour le chat", async () => {
    const response = await chatRoute(
      new Request("http://localhost/api/documents/doc-1/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "Résumé ?" }] }),
      }) as never,
      params
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Stockage non configuré");
    expect(chatWithDocument).not.toHaveBeenCalled();
  });
});
