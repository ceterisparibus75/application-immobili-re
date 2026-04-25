import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, getDueCronTasks } from "./route";

describe("GET /api/cron/daily-maintenance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T08:15:00.000Z"));
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
        text: vi.fn().mockResolvedValue("ok"),
      })
    );
  });

  it("refuse les appels sans secret cron", async () => {
    const response = await GET(new Request("http://localhost/api/cron/daily-maintenance") as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Non autorise" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("execute les taches quotidiennes dont le rattrapage des brouillons", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/daily-maintenance", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, executed: 6, failed: 0 });
    expect(fetch).toHaveBeenCalledWith(new URL("/api/cron/generate-drafts", "http://localhost/api/cron/daily-maintenance"), {
      method: "GET",
      headers: {
        Authorization: "Bearer cron-secret",
        "x-cron-orchestrator": "daily-maintenance",
      },
      cache: "no-store",
    });
  });

  it("ajoute les taches hebdomadaires et mensuelles quand elles sont dues", () => {
    const tasks = getDueCronTasks(new Date("2026-06-01T08:15:00.000Z")).map((task) => task.path);

    expect(tasks).toContain("/api/cron/generate-drafts");
    expect(tasks).toContain("/api/cron/invoice-reminder");
    expect(tasks).toContain("/api/cron/insurance-reminder");
    expect(tasks).toContain("/api/cron/sync-indices");
    expect(tasks).toContain("/api/cron/rent-revisions");
  });

  it("remonte les echecs sans bloquer les autres taches", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "boom" }),
        text: vi.fn().mockResolvedValue("boom"),
      } as never)
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true }),
        text: vi.fn().mockResolvedValue("ok"),
      } as never);

    const response = await GET(
      new Request("http://localhost/api/cron/daily-maintenance", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body).toMatchObject({ success: false, executed: 6, failed: 1 });
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});
