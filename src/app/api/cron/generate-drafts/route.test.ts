import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";

const { getNextInvoiceNumber } = vi.hoisted(() => ({
  getNextInvoiceNumber: vi.fn(),
}));

vi.mock("@/actions/invoice-shared", () => ({
  getNextInvoiceNumber,
}));

import { GET } from "./route";

describe("GET /api/cron/generate-drafts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T12:00:00.000Z"));
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    getNextInvoiceNumber.mockResolvedValue("AJHOLD-2026-0007");
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.rentRevision.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock)
    );
    prismaMock.invoice.create.mockResolvedValue({ id: "invoice-1" } as never);
  });

  it("refuse les appels sans secret cron", async () => {
    const response = await GET(new Request("http://localhost/api/cron/generate-drafts") as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Non autorise" });
    expect(prismaMock.lease.findMany).not.toHaveBeenCalled();
  });

  it("cree les brouillons J-10 avec la numerotation partagee de la societe", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1",
        societyId: "society-1",
        tenantId: "tenant-1",
        startDate: new Date("2024-01-01T00:00:00.000Z"),
        endDate: new Date("2033-01-01T00:00:00.000Z"),
        paymentFrequency: "MENSUEL",
        billingTerm: "A_ECHOIR",
        currentRentHT: 1000,
        vatApplicable: false,
        vatRate: 20,
        rentFreeMonths: 0,
        progressiveRent: null,
        rentSteps: [],
        chargeProvisions: [],
        lot: {
          number: "Lot 2",
          building: { name: "41 Rue de Paris" },
        },
      },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/cron/generate-drafts", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, created: 1, skipped: 0, errors: [] });
    expect(getNextInvoiceNumber).toHaveBeenCalledWith("society-1", prismaMock);
    expect(prismaMock.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: "society-1",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        invoiceNumber: "AJHOLD-2026-0007",
        invoiceType: "APPEL_LOYER",
        status: "BROUILLON",
        totalHT: 1000,
        totalVAT: 0,
        totalTTC: 1000,
      }),
    });
  });
});
