import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.lease.findMany.mockResolvedValue([]);
  prismaMock.diagnostic.findMany.mockResolvedValue([]);
});

import { GET } from "./route";

describe("GET /api/cron/lease-alerts", () => {
  it("retourne 500 si CRON_SECRET non configuré", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/lease-alerts") as never);
    expect(response.status).toBe(500);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization manquant", async () => {
    const response = await GET(new Request("http://localhost/api/cron/lease-alerts") as never);
    expect(response.status).toBe(401);
  });

  it("retourne 200 sans notifications si aucun bail ni diagnostic n'expire", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/lease-alerts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      expiringLeases: 0,
      expiringDiagnostics: 0,
      notificationsCreated: 0,
    });
  });

  it("crée une notification pour un bail expirant dans 60 jours", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        societyId: "soc-1",
        endDate: new Date("2026-06-25T00:00:00.000Z"),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Dupont", companyName: null },
        lot: { number: "A1", building: { name: "Résidence des Lilas" } },
      },
    ] as never);
    prismaMock.userSociety.findMany.mockResolvedValue([{ userId: "user-1" }] as never);
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const response = await GET(
      new Request("http://localhost/api/cron/lease-alerts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.expiringLeases).toBe(1);
    expect(body.notificationsCreated).toBe(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "BAIL_EXPIRING",
          societyId: "soc-1",
          userId: "user-1",
        }),
      })
    );
  });

  it("ne crée pas de notification si elle existe déjà ce mois", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        societyId: "soc-1",
        endDate: new Date("2026-06-25T00:00:00.000Z"),
        tenant: { entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Dupont", companyName: null },
        lot: { number: "A1", building: { name: "Résidence des Lilas" } },
      },
    ] as never);
    prismaMock.userSociety.findMany.mockResolvedValue([{ userId: "user-1" }] as never);
    prismaMock.notification.findFirst.mockResolvedValue({ id: "notif-existing" } as never);

    const response = await GET(
      new Request("http://localhost/api/cron/lease-alerts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.notificationsCreated).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("crée une notification pour un diagnostic expirant dans 20 jours", async () => {
    prismaMock.diagnostic.findMany.mockResolvedValue([
      {
        id: "diag-1",
        type: "DPE",
        expiresAt: new Date("2026-05-16T00:00:00.000Z"),
        building: { id: "building-1", name: "Le Grand Immeuble", societyId: "soc-1" },
      },
    ] as never);
    prismaMock.userSociety.findMany.mockResolvedValue([{ userId: "user-1" }] as never);
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({} as never);

    const response = await GET(
      new Request("http://localhost/api/cron/lease-alerts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.expiringDiagnostics).toBe(1);
    expect(body.notificationsCreated).toBe(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "DIAGNOSTIC_EXPIRING" }),
      })
    );
  });

  it("retourne 500 si la BDD échoue", async () => {
    prismaMock.lease.findMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/lease-alerts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
