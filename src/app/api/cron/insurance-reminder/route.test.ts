import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { sendInsuranceReminderEmail } = vi.hoisted(() => ({
  sendInsuranceReminderEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({ sendInsuranceReminderEmail }));
vi.mock("@/lib/env", () => ({ env: { AUTH_URL: "https://app.test", CRON_SECRET: "cron-secret" } }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.tenant.findMany.mockResolvedValue([]);
  prismaMock.tenant.update.mockResolvedValue({} as never);
});

describe("GET /api/cron/insurance-reminder", () => {
  it("retourne 500 si CRON_SECRET non configuré", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/insurance-reminder") as never);
    expect(response.status).toBe(500);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization manquant", async () => {
    const response = await GET(new Request("http://localhost/api/cron/insurance-reminder") as never);
    expect(response.status).toBe(401);
  });

  it("retourne sent=0 si aucun locataire éligible", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/insurance-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, sent: 0 });
    expect(sendInsuranceReminderEmail).not.toHaveBeenCalled();
  });

  it("envoie un rappel et met à jour insuranceReminderSentAt pour chaque locataire", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: "ten-1",
        email: "tenant@test.com",
        entityType: "PERSONNE_PHYSIQUE",
        firstName: "Marie",
        lastName: "Dupont",
        companyName: null,
        society: { name: "SCI Romain" },
      },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/cron/insurance-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, sent: 1 });
    expect(sendInsuranceReminderEmail).toHaveBeenCalledWith({
      to: "tenant@test.com",
      tenantName: "Marie Dupont",
      societyName: "SCI Romain",
      portalUrl: "https://app.test",
    });
    expect(prismaMock.tenant.update).toHaveBeenCalledWith({
      where: { id: "ten-1" },
      data: { insuranceReminderSentAt: expect.any(Date) },
    });
  });

  it("utilise companyName pour une personne morale", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: "ten-2",
        email: "sarl@test.com",
        entityType: "PERSONNE_MORALE",
        companyName: "SARL Dupont",
        firstName: null,
        lastName: null,
        society: { name: "SCI" },
      },
    ] as never);

    await GET(
      new Request("http://localhost/api/cron/insurance-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(sendInsuranceReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tenantName: "SARL Dupont" })
    );
  });

  it("retourne 500 si la BDD échoue", async () => {
    prismaMock.tenant.findMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/insurance-reminder", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
