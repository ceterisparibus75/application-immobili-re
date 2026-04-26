import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveSocietyRouteContext, createClient, Anthropic } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createClient: vi.fn(),
  Anthropic: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@anthropic-ai/sdk", () => ({ default: Anthropic }));

import { POST } from "./route";

describe("POST /api/diagnostics/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
      role: "GESTIONNAIRE",
    });
  });

  it("échoue proprement si le stockage Supabase n'est pas configuré", async () => {
    const response = await POST(
      new Request("http://localhost/api/diagnostics/analyze", { method: "POST" }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Stockage non configuré");
    expect(createClient).not.toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });
});
