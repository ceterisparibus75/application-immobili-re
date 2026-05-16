// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPortalSession } = vi.hoisted(() => ({
  getPortalSession: vi.fn(),
}));

vi.mock("@/lib/portal-auth", () => ({ getPortalSession }));
vi.mock("@/lib/env", () => ({ env: process.env }));

import { POST } from "./route";

function formRequest(file: File) {
  const form = new FormData();
  form.append("file", file);
  return new Request("http://localhost/api/portal/upload-document", {
    method: "POST",
    body: form,
  }) as never;
}

describe("POST /api/portal/upload-document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPortalSession.mockResolvedValue({ tenantId: "tenant-1", email: "tenant@test.fr" });
  });

  it("rejette un PDF déclaré dont les magic bytes ne sont pas ceux d'un PDF", async () => {
    const response = await POST(
      formRequest(new File([new TextEncoder().encode("not a pdf")], "attestation.pdf", { type: "application/pdf" }))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toContain("contenu du fichier");
  });
});
