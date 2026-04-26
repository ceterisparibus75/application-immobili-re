import { beforeEach, describe, expect, it, vi } from "vitest";

const { detectPendingRevisions } = vi.hoisted(() => ({
  detectPendingRevisions: vi.fn(),
}));

vi.mock("@/actions/rent-revision", () => ({ detectPendingRevisions }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  detectPendingRevisions.mockResolvedValue({ created: 0, errors: [] });
});

describe("GET /api/cron/rent-revisions", () => {
  it("retourne 401 si CRON_SECRET non configuré ou header manquant", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/rent-revisions") as never);
    expect(response.status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/rent-revisions", {
        headers: { Authorization: "Bearer wrong" },
      }) as never
    );
    expect(response.status).toBe(401);
  });

  it("délègue à detectPendingRevisions et retourne les résultats", async () => {
    detectPendingRevisions.mockResolvedValue({ created: 5, errors: [] });

    const response = await GET(
      new Request("http://localhost/api/cron/rent-revisions", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, created: 5, errors: [] });
    expect(detectPendingRevisions).toHaveBeenCalledOnce();
  });

  it("retourne 500 si detectPendingRevisions lève une exception", async () => {
    detectPendingRevisions.mockRejectedValue(new Error("Unexpected error"));

    const response = await GET(
      new Request("http://localhost/api/cron/rent-revisions", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("révisions");
  });
});
