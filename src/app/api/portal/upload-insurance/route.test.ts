import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requirePortalAuth } = vi.hoisted(() => ({
  requirePortalAuth: vi.fn(),
}));

vi.mock("@/lib/portal-auth", () => ({ requirePortalAuth }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn() } })),
}));

import { POST } from "./route";

function formRequest(file: File) {
  const form = new FormData();
  form.append("file", file);
  return new Request("http://localhost/api/portal/upload-insurance", {
    method: "POST",
    body: form,
  }) as never;
}

describe("POST /api/portal/upload-insurance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    requirePortalAuth.mockResolvedValue({ tenantId: "tenant-1", email: "tenant@test.fr" });
  });

  it("rejette un PDF déclaré dont les magic bytes ne sont pas ceux d'un PDF", async () => {
    const response = await POST(
      formRequest(new File([new TextEncoder().encode("not a pdf")], "assurance.pdf", { type: "application/pdf" }))
    );

    expect(response.status).toBe(400);
    expect(prismaMock.tenant.findFirst).not.toHaveBeenCalled();
  });
});
