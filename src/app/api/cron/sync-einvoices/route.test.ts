import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/env", () => ({ env: { CRON_SECRET: "cron-secret" } }));

const { isEInvoicingConfigured } = vi.hoisted(() => ({
  isEInvoicingConfigured: vi.fn().mockReturnValue(true),
}));
const { _syncForSociety } = vi.hoisted(() => ({
  _syncForSociety: vi.fn(),
}));

vi.mock("@/lib/pa-client", () => ({ isEInvoicingConfigured }));
vi.mock("@/actions/einvoicing", () => ({ _syncForSociety }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  isEInvoicingConfigured.mockReturnValue(true);
  _syncForSociety.mockResolvedValue({ success: true, data: { created: 0, updated: 0 } });
  prismaMock.society.findMany.mockResolvedValue([]);
});

describe("GET /api/cron/sync-einvoices", () => {
  it("retourne 401 si Authorization manquant ou incorrect", async () => {
    const responseNoHeader = await GET(new Request("http://localhost/api/cron/sync-einvoices") as never);
    expect(responseNoHeader.status).toBe(401);

    const responseWrong = await GET(
      new Request("http://localhost/api/cron/sync-einvoices", {
        headers: { Authorization: "Bearer wrong" },
      }) as never
    );
    expect(responseWrong.status).toBe(401);
  });

  it("retourne 200 avec message si la facturation électronique n'est pas configurée", async () => {
    isEInvoicingConfigured.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/sync-einvoices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.message).toContain("non configurée");
    expect(prismaMock.society.findMany).not.toHaveBeenCalled();
  });

  it("retourne 0 sociétés si aucune n'est inscrite à l'annuaire PPF", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-einvoices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ societies: 0, created: 0, updated: 0, errors: 0 });
  });

  it("synchronise les factures reçues pour chaque société inscrite", async () => {
    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-1", name: "SCI Dupont", siret: "12345678901234" },
      { id: "soc-2", name: "SARL Martin", siret: "98765432109876" },
    ] as never);
    _syncForSociety
      .mockResolvedValueOnce({ success: true, data: { created: 3, updated: 1 } })
      .mockResolvedValueOnce({ success: true, data: { created: 0, updated: 2 } });

    const response = await GET(
      new Request("http://localhost/api/cron/sync-einvoices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.societies).toBe(2);
    expect(body.created).toBe(3);
    expect(body.updated).toBe(3);
    expect(body.errors).toBe(0);
    expect(_syncForSociety).toHaveBeenCalledWith("soc-1", "12345678901234");
    expect(_syncForSociety).toHaveBeenCalledWith("soc-2", "98765432109876");
  });

  it("enregistre une erreur dans le résumé si _syncForSociety échoue pour une société", async () => {
    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-err", name: "SCI Erreur", siret: "11111111111111" },
    ] as never);
    _syncForSociety.mockResolvedValue({ success: false, error: "PA timeout" });

    const response = await GET(
      new Request("http://localhost/api/cron/sync-einvoices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.errors).toBe(1);
    expect(body.summary[0].error).toBe("PA timeout");
  });

  it("capture les exceptions et les ajoute au résumé", async () => {
    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-ex", name: "SCI Exception", siret: "22222222222222" },
    ] as never);
    _syncForSociety.mockRejectedValue(new Error("Network error"));

    const response = await GET(
      new Request("http://localhost/api/cron/sync-einvoices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.errors).toBe(1);
    expect(body.summary[0].error).toBe("Network error");
  });
});
