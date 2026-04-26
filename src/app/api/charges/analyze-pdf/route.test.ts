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

describe("POST /api/charges/analyze-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
      role: "GESTIONNAIRE",
    });
  });

  it("échoue proprement si l'analyse IA n'est pas configurée", async () => {
    const response = await POST(
      new Request("http://localhost/api/charges/analyze-pdf", { method: "POST" }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Analyse IA non configurée");
    expect(createClient).not.toHaveBeenCalled();
    expect(Anthropic).not.toHaveBeenCalled();
  });
});
