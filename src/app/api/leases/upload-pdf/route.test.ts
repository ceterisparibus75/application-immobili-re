// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { requireActiveSocietyRouteContext } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({ requireActiveSocietyRouteContext }));
vi.mock("@/lib/env", () => ({ env: process.env }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn() } })),
}));

import { POST } from "./route";

function formRequest(file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("leaseId", "lease-1");
  return new Request("http://localhost/api/leases/upload-pdf", {
    method: "POST",
    body: form,
  }) as never;
}

describe("POST /api/leases/upload-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "soc-1",
      userId: "user-1",
      role: "GESTIONNAIRE",
    });
  });

  it("rejette un PDF déclaré dont les magic bytes ne sont pas ceux d'un PDF", async () => {
    const response = await POST(
      formRequest(new File([new TextEncoder().encode("not a pdf")], "bail.pdf", { type: "application/pdf" }))
    );

    expect(response.status).toBe(400);
    expect(prismaMock.lease.findFirst).not.toHaveBeenCalled();
  });
});
