import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveSocietyRouteContext, createClient, Anthropic, findFirst } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createClient: vi.fn(),
  Anthropic: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@anthropic-ai/sdk", () => ({ default: Anthropic }));
vi.mock("@/lib/prisma", () => ({ prisma: { lease: { findFirst } } }));

import { POST } from "./route";

describe("POST /api/lease-amendments/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
    });
  });

  it("refuse un storagePath temporaire d'un autre tenant avant tout accès données", async () => {
    const response = await POST(
      new Request("http://localhost/api/lease-amendments/analyze", {
        method: "POST",
        body: JSON.stringify({
          storagePath: "temp/other-soc/import/avenant.pdf",
          leaseId: "lease-1",
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Accès non autorisé au fichier");
    expect(findFirst).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });
});
