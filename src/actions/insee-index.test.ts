import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { createAuditLog } from "@/lib/audit";
import { syncInseeIndices } from "./insee-index";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

const SDMX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData>
  <message:DataSet>
    <Obs TIME_PERIOD="2025-Q1" OBS_VALUE="145.78" STATUS="A" />
    <Obs TIME_PERIOD="2024-Q4" OBS_VALUE="143.20" STATUS="A" />
  </message:DataSet>
</message:StructureSpecificData>`;

function mockFetch(ok: boolean, text: string = SDMX_XML, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: vi.fn().mockResolvedValue(text),
    })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncInseeIndices", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await syncInseeIndices(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("synchronise tous les indices avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    mockFetch(true);
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);

    const result = await syncInseeIndices(SOCIETY_ID);
    expect(result.success).toBe(true);
    // 4 séries × 2 observations chacune
    expect(prismaMock.inseeIndex.upsert).toHaveBeenCalledTimes(8);
    expect(result.data?.errors).toHaveLength(0);
  });

  it("synchronise uniquement les séries demandées", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    mockFetch(true);
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(true);
    // 1 série × 2 observations
    expect(prismaMock.inseeIndex.upsert).toHaveBeenCalledTimes(2);
    expect(result.data?.synced["IRL"]).toBe(2);
  });

  it("enregistre une erreur si l'API INSEE répond avec un code d'erreur HTTP", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    mockFetch(false, "", 503);

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toMatch(/erreur INSEE/);
    expect(result.data?.synced["IRL"]).toBeUndefined();
  });

  it("ignore les observations avec une valeur non numérique", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          `<Obs TIME_PERIOD="2025-Q1" OBS_VALUE="N/A" />
           <Obs TIME_PERIOD="2024-Q4" OBS_VALUE="143.20" />`
        ),
      })
    );
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(true);
    // Seulement 1 observation valide sur 2
    expect(result.data?.synced["IRL"]).toBe(1);
  });

  it("ignore les observations avec une période invalide", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(
          `<Obs TIME_PERIOD="invalid-period" OBS_VALUE="145.78" />
           <Obs TIME_PERIOD="2024-Q4" OBS_VALUE="143.20" />`
        ),
      })
    );
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(true);
    expect(result.data?.synced["IRL"]).toBe(1);
  });

  it("retourne synced=0 si le XML ne contient aucune observation", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("<data></data>"),
      })
    );

    const result = await syncInseeIndices(SOCIETY_ID, ["ILC"]);
    expect(result.success).toBe(true);
    expect(result.data?.synced["ILC"]).toBe(0);
  });

  it("parse le format Generic XML si aucun résultat StructureSpecific (lignes 45-51)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(
        `<generic:Obs>
          <generic:ObsKey>
            <generic:Value id="TIME_PERIOD" value="2025-T1" />
          </generic:ObsKey>
          <generic:ObsValue value="145.78" />
        </generic:Obs>`
      ),
    }));
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(true);
    expect(result.data?.synced["IRL"]).toBe(1);
  });

  it("enregistre une erreur si l'upsert BDD échoue pour un index (lignes 141-142)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    mockFetch(true);
    prismaMock.inseeIndex.upsert.mockRejectedValue(new Error("DB upsert error"));

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toMatch(/IRL/);
  });

  it("retourne ForbiddenError si rôle insuffisant (lignes 161-162)", async () => {
    mockAuthSession("LECTURE", SOCIETY_ID);

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur générique si createAuditLog échoue (lignes 163-164)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    mockFetch(true);
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);
    vi.mocked(createAuditLog).mockRejectedValueOnce(new Error("audit KO"));

    const result = await syncInseeIndices(SOCIETY_ID, ["IRL"]);
    expect(result.success).toBe(false);
    expect(result.error).toContain("synchronisation");
  });

  it("upserte avec les bons paramètres (indexType, year, quarter, value)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    mockFetch(true, `<Obs TIME_PERIOD="2025-Q2" OBS_VALUE="148.50" />`);
    prismaMock.inseeIndex.upsert.mockResolvedValue({} as never);

    await syncInseeIndices(SOCIETY_ID, ["IRL"]);

    expect(prismaMock.inseeIndex.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { indexType_year_quarter: { indexType: "IRL", year: 2025, quarter: 2 } },
        update: { value: 148.5 },
        create: expect.objectContaining({ indexType: "IRL", year: 2025, quarter: 2, value: 148.5 }),
      })
    );
  });
});
