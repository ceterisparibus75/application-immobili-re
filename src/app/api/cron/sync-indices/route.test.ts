import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("@/lib/env", () => ({ env: process.env }));

const SDMX_XML = `<?xml version="1.0"?>
<message:StructureSpecificData>
  <message:DataSet>
    <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.78" STATUS="A" />
    <Obs TIME_PERIOD="2025-Q3" OBS_VALUE="144.20" STATUS="A" />
  </message:DataSet>
</message:StructureSpecificData>`;

function mockFetchOk(xml = SDMX_XML) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, text: vi.fn().mockResolvedValue(xml) })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);
  mockFetchOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRON_SECRET;
});

import { GET } from "./route";

describe("GET /api/cron/sync-indices", () => {
  it("retourne 401 si CRON_SECRET non configuré ou header manquant", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/sync-indices") as never);
    expect(response.status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-indices", {
        headers: { Authorization: "Bearer wrong" },
      }) as never
    );
    expect(response.status).toBe(401);
  });

  it("synchronise les 4 séries INSEE et upserte les observations", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-indices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // 4 séries × 2 observations = 8 upserts
    expect(prismaMock.inseeIndex.upsert).toHaveBeenCalledTimes(8);
    expect(body.results.IRL.synced).toBe(2);
    expect(body.results.ILC.synced).toBe(2);
    expect(body.results.ILAT.synced).toBe(2);
    expect(body.results.ICC.synced).toBe(2);
  });

  it("upserte avec les bons paramètres (indexType, year, quarter, value)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(`<Obs TIME_PERIOD="2026-Q1" OBS_VALUE="147.50" />`),
      })
    );

    await GET(
      new Request("http://localhost/api/cron/sync-indices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );

    expect(prismaMock.inseeIndex.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { indexType_year_quarter: { indexType: "IRL", year: 2026, quarter: 1 } },
        update: { value: 147.5 },
        create: expect.objectContaining({ indexType: "IRL", year: 2026, quarter: 1, value: 147.5 }),
      })
    );
  });

  it("enregistre une erreur dans results si l'API INSEE échoue pour une série", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, text: vi.fn().mockResolvedValue("") })
    );

    const response = await GET(
      new Request("http://localhost/api/cron/sync-indices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.results.IRL.synced).toBe(0);
    expect(body.results.IRL.error).toBeTruthy();
    expect(prismaMock.inseeIndex.upsert).not.toHaveBeenCalled();
  });

  it("ignore les observations avec valeur non numérique", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          `<Obs TIME_PERIOD="2026-Q1" OBS_VALUE="N/A" />
           <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="145.20" />`
        ),
      })
    );

    const response = await GET(
      new Request("http://localhost/api/cron/sync-indices", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    // 4 séries × 1 observation valide = 4 upserts
    expect(prismaMock.inseeIndex.upsert).toHaveBeenCalledTimes(4);
    expect(body.results.IRL.synced).toBe(1);
  });
});
