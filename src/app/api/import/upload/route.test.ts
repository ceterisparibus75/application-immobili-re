import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveSocietyRouteContext, createClient } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { POST } from "./route";

describe("POST /api/import/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
    });
  });

  it("échoue proprement si le stockage n'est pas configuré", async () => {
    const response = await POST(
      new Request("http://localhost/api/import/upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: "bail.pdf",
          chunkIndex: 0,
          totalChunks: 1,
          data: Buffer.from("%PDF").toString("base64"),
          uploadId: "upload-1",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Stockage non configuré");
    expect(createClient).not.toHaveBeenCalled();
  });
});
