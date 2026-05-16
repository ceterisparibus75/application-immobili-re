import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendMail }));
vi.mock("@/lib/env", () => ({ env: process.env }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  process.env.AUTH_URL = "https://app.test";
  prismaMock.document.findMany.mockResolvedValue([]);
  prismaMock.userSociety.findMany.mockResolvedValue([]);
});

describe("GET /api/cron/document-alerts", () => {
  it("retourne 401 si Authorization manquant", async () => {
    const response = await GET(new Request("http://localhost/api/cron/document-alerts") as never);
    expect(response.status).toBe(401);
  });

  it("retourne 401 si Authorization invalide", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/document-alerts", {
        headers: { Authorization: "Bearer wrong-secret" },
      }) as never,
    );
    expect(response.status).toBe(401);
  });

  it("retourne 401 si l'ancien header x-cron-secret est utilisé (régression Vercel Cron)", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/document-alerts", {
        headers: { "x-cron-secret": "cron-secret" },
      }) as never,
    );
    // Le helper accepte uniquement Authorization: Bearer (compatible Vercel Cron)
    expect(response.status).toBe(401);
  });

  it("accepte Authorization: Bearer <secret> (Vercel Cron)", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/document-alerts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sent).toBe(0);
  });
});
