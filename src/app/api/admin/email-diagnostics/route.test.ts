import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { requireAuthenticatedRouteContext, requireSuperAdmin, Resend } = vi.hoisted(() => ({
  requireAuthenticatedRouteContext: vi.fn(),
  requireSuperAdmin: vi.fn(),
  Resend: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuthenticatedRouteContext,
}));

vi.mock("@/lib/permissions", () => ({
  requireSuperAdmin,
}));

vi.mock("resend", () => ({
  Resend,
}));

import { GET, POST } from "./route";

describe("/api/admin/email-diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.NEXT_PUBLIC_APP_NAME = "Mygestia";
    requireAuthenticatedRouteContext.mockResolvedValue({ userId: "user-1" });
    requireSuperAdmin.mockResolvedValue(true);
  });

  it("refuse un appel GET non authentifie", async () => {
    requireAuthenticatedRouteContext.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Non autorise" });
    expect(requireSuperAdmin).not.toHaveBeenCalled();
  });

  it("refuse un appel GET authentifie mais non super-admin", async () => {
    requireSuperAdmin.mockRejectedValue(new Error("Forbidden"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("super administrateurs");
  });

  it("refuse aussi un appel POST non super-admin avant toute action Resend", async () => {
    process.env.RESEND_API_KEY = "resend-key";
    requireSuperAdmin.mockRejectedValue(new Error("Forbidden"));

    const response = await POST(
      new Request("http://localhost/api/admin/email-diagnostics", {
        method: "POST",
        body: JSON.stringify({ action: "test_send", to: "test@example.com" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("super administrateurs");
    expect(Resend).not.toHaveBeenCalled();
  });

  it("autorise un super-admin a obtenir le diagnostic de configuration manquante", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "error",
      message: "RESEND_API_KEY manquant",
      emailFrom: "noreply@example.com",
    });
    expect(requireSuperAdmin).toHaveBeenCalledWith("user-1");
  });
});
