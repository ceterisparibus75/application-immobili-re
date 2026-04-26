import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/env", () => ({ env: process.env }));

import { GET } from "./route";

const CRON_SECRET = "cron-secret-test";

function makeRequest(auth?: string) {
  return new Request("http://localhost/api/cron/data-retention-cleanup", {
    headers: auth ? { Authorization: auth } : {},
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.gdprRequest.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.consent.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.tenant.findMany.mockResolvedValue([]);
});

describe("GET /api/cron/data-retention-cleanup", () => {
  it("retourne 401 sans Authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("retourne 401 avec un secret incorrect", async () => {
    const res = await GET(makeRequest("Bearer mauvais-secret"));
    expect(res.status).toBe(401);
  });

  it("retourne 200 avec le rapport de purge RGPD", async () => {
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 42 });
    prismaMock.gdprRequest.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.consent.deleteMany.mockResolvedValue({ count: 7 });
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 150 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.auditDeleted).toBe(42);
    expect(body.gdprDeleted).toBe(3);
    expect(body.consentDeleted).toBe(7);
    expect(body.notificationsDeleted).toBe(150);
    expect(body.anonymized).toBe(0);
  });

  it("anonymise les locataires archives eligibles (> 5 ans)", async () => {
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000 - 1000);
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: "tenant-old",
        societyId: "soc-1",
        leases: [{ endDate: fiveYearsAgo }],
      } as never,
    ]);
    prismaMock.tenant.update.mockResolvedValue({} as never);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.anonymized).toBe(1);
    expect(prismaMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-old" },
        data: expect.objectContaining({
          email: "anonymized_tenant-old@purge.rgpd",
          firstName: null,
          lastName: null,
        }),
      })
    );
  });

  it("ne traite pas les locataires sans bail", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: "tenant-no-lease", societyId: "soc-1", leases: [] } as never,
    ]);

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(body.anonymized).toBe(0);
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
  });

  it("purge les consentements revoques", async () => {
    prismaMock.consent.deleteMany.mockResolvedValue({ count: 5 });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();

    expect(body.consentDeleted).toBe(5);
    expect(prismaMock.consent.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isGranted: false }),
      })
    );
  });
});
