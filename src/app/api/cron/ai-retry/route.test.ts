import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/env", () => ({ env: process.env }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  vi.stubGlobal(
    "setTimeout",
    (fn: () => void) => { fn(); return 0 as unknown as ReturnType<typeof setTimeout>; }
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRON_SECRET;
});

import { GET } from "./route";

describe("GET /api/cron/ai-retry", () => {
  it("retourne 500 si CRON_SECRET non configuré", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/ai-retry") as never);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("CRON_NOT_CONFIGURED");
  });

  it("retourne 401 si Authorization manquant", async () => {
    const response = await GET(new Request("http://localhost/api/cron/ai-retry") as never);
    expect(response.status).toBe(401);
  });

  it("retourne 401 si Authorization incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/ai-retry", {
        headers: { Authorization: "Bearer wrong-secret" },
      }) as never
    );
    expect(response.status).toBe(401);
  });

  it("retourne 0 documents à retraiter si la liste est vide", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    const response = await GET(
      new Request("http://localhost/api/cron/ai-retry", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, retried: 0, message: "Aucun document à retraiter" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retente les documents en erreur et compte les succès et échecs", async () => {
    prismaMock.document.findMany.mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }] as never);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as never)
      .mockResolvedValueOnce({ ok: false, status: 422 } as never);

    const response = await GET(
      new Request("http://localhost/api/cron/ai-retry", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, total: 2, retried: 1, failed: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("compte un échec si fetch rejette", async () => {
    prismaMock.document.findMany.mockResolvedValue([{ id: "doc-1" }] as never);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const response = await GET(
      new Request("http://localhost/api/cron/ai-retry", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, total: 1, retried: 0, failed: 1 });
  });

  it("retourne 500 si la BDD échoue", async () => {
    prismaMock.document.findMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/ai-retry", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
