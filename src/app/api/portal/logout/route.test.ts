import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearPortalSession } = vi.hoisted(() => ({
  clearPortalSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/portal-auth", () => ({ clearPortalSession }));

import { GET, POST } from "./route";

describe("/api/portal/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige le POST vers la page de connexion locataire", async () => {
    const response = await POST(new Request("http://localhost/api/portal/logout", { method: "POST" }));

    expect(clearPortalSession).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/portal/login");
  });

  it("redirige aussi le GET vers la page de connexion locataire", async () => {
    const response = await GET(new Request("http://localhost/api/portal/logout"));

    expect(clearPortalSession).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/portal/login");
  });
});
