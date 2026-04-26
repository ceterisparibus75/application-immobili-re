import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 } as never);
  prismaMock.invoice.findMany.mockResolvedValue([]);
});

import { GET } from "./route";

describe("GET /api/cron/invoice-reminder", () => {
  it("retourne 500 si CRON_SECRET non configuré", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/invoice-reminder") as never);
    expect(response.status).toBe(500);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization manquant", async () => {
    const response = await GET(new Request("http://localhost/api/cron/invoice-reminder") as never);
    expect(response.status).toBe(401);
  });

  it("marque les factures en retard et retourne le compte sans reminders si liste vide", async () => {
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 3 } as never);

    const response = await GET(
      new Request("http://localhost/api/cron/invoice-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, overdueMarked: 3, remindersCreated: 0 });
  });

  it("crée une relance si le scénario s'applique", async () => {
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        societyId: "soc-1",
        tenantId: "ten-1",
        dueDate: new Date("2026-04-10T00:00:00.000Z"),
        totalTTC: 1000,
        totalHT: 900,
        lease: { id: "lease-1", societyId: "soc-1" },
        tenant: { id: "ten-1", email: "tenant@test.com" },
      },
    ] as never);
    prismaMock.reminderScenario.findFirst.mockResolvedValue({
      id: "scenario-1",
      steps: [
        {
          level: 1,
          daysAfterDue: 7,
          requiresValidation: false,
          channel: "EMAIL",
          subject: "Relance",
          bodyTemplate: "Votre loyer est en retard.",
        },
      ],
    } as never);
    prismaMock.reminder.findMany.mockResolvedValue([]);
    prismaMock.reminder.create.mockResolvedValue({} as never);
    prismaMock.invoice.update.mockResolvedValue({} as never);

    const response = await GET(
      new Request("http://localhost/api/cron/invoice-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, overdueMarked: 1, remindersCreated: 1 });
    expect(prismaMock.reminder.create).toHaveBeenCalledOnce();
  });

  it("saute la relance si le scénario exige une validation manuelle", async () => {
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-2",
        societyId: "soc-1",
        tenantId: "ten-1",
        dueDate: new Date("2026-04-10T00:00:00.000Z"),
        totalTTC: 500,
        totalHT: 500,
        lease: { id: "lease-1", societyId: "soc-1" },
        tenant: { id: "ten-1", email: "tenant@test.com" },
      },
    ] as never);
    prismaMock.reminderScenario.findFirst.mockResolvedValue({
      id: "scenario-1",
      steps: [{ level: 1, daysAfterDue: 7, requiresValidation: true }],
    } as never);
    prismaMock.reminder.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/cron/invoice-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.remindersCreated).toBe(0);
    expect(prismaMock.reminder.create).not.toHaveBeenCalled();
  });

  it("retourne 500 si la BDD échoue", async () => {
    prismaMock.invoice.updateMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/invoice-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
