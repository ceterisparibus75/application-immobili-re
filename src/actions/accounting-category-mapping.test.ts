import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  deleteMapping,
  listMappings,
  seedDefaultMappings,
  upsertMapping,
} from "./accounting-category-mapping";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const MAPPING_ID = "clh3x2z4k0010qh8g7z1y2v3t";

describe("listMappings", () => {
  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
  });

  it("refuse l'appel non authentifié", async () => {
    mockUnauthenticated();
    const res = await listMappings(SOCIETY_ID);
    expect(res.success).toBe(false);
  });

  it("retourne la liste pour la société", async () => {
    prismaMock.accountingCategoryMapping.findMany.mockResolvedValue([
      {
        id: MAPPING_ID,
        societyId: SOCIETY_ID,
        cashflowCategoryId: "energie",
        keyword: null,
        accountCode: "606200",
        accountLabel: "Énergie dérivée",
        notes: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ] as never);

    const res = await listMappings(SOCIETY_ID);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]).toMatchObject({
      id: MAPPING_ID,
      cashflowCategoryId: "energie",
      accountCode: "606200",
    });
  });
});

describe("upsertMapping — par cashflowCategoryId", () => {
  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
  });

  it("rejette un payload sans ni catégorie ni mot-clé", async () => {
    const res = await upsertMapping(SOCIETY_ID, {
      cashflowCategoryId: null,
      keyword: null,
      accountCode: "606200",
    });
    expect(res.success).toBe(false);
  });

  it("rejette un payload avec catégorie ET mot-clé", async () => {
    const res = await upsertMapping(SOCIETY_ID, {
      cashflowCategoryId: "energie",
      keyword: "ELECTRICITE",
      accountCode: "606200",
    });
    expect(res.success).toBe(false);
  });

  it("crée (upsert) un mapping par catégorie cashflow", async () => {
    const now = new Date("2026-01-02");
    prismaMock.accountingCategoryMapping.upsert.mockResolvedValue({
      id: MAPPING_ID,
      createdAt: now,
      updatedAt: now,
    } as never);

    const res = await upsertMapping(SOCIETY_ID, {
      cashflowCategoryId: "energie",
      keyword: null,
      accountCode: "606200",
      accountLabel: "Énergie - variante",
      notes: null,
    });

    expect(res).toEqual({ success: true, data: { id: MAPPING_ID } });
    expect(prismaMock.accountingCategoryMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societyId_cashflowCategoryId: {
            societyId: SOCIETY_ID,
            cashflowCategoryId: "energie",
          },
        },
      })
    );
  });
});

describe("upsertMapping — par keyword", () => {
  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
  });

  it("upsert via keyword", async () => {
    const now = new Date("2026-01-02");
    prismaMock.accountingCategoryMapping.upsert.mockResolvedValue({
      id: MAPPING_ID,
      createdAt: now,
      updatedAt: now,
    } as never);

    const res = await upsertMapping(SOCIETY_ID, {
      cashflowCategoryId: null,
      keyword: "ASCENSEUR",
      accountCode: "615200",
    });

    expect(res).toEqual({ success: true, data: { id: MAPPING_ID } });
    expect(prismaMock.accountingCategoryMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          societyId_keyword: {
            societyId: SOCIETY_ID,
            keyword: "ASCENSEUR",
          },
        },
      })
    );
  });
});

describe("deleteMapping", () => {
  beforeEach(() => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
  });

  it("refuse un mapping inconnu / d'une autre société", async () => {
    prismaMock.accountingCategoryMapping.findFirst.mockResolvedValue(null);
    const res = await deleteMapping(SOCIETY_ID, MAPPING_ID);
    expect(res.success).toBe(false);
    expect(prismaMock.accountingCategoryMapping.delete).not.toHaveBeenCalled();
  });

  it("supprime un mapping existant scopé à la société", async () => {
    prismaMock.accountingCategoryMapping.findFirst.mockResolvedValue({
      id: MAPPING_ID,
    } as never);
    prismaMock.accountingCategoryMapping.delete.mockResolvedValue({
      id: MAPPING_ID,
    } as never);

    const res = await deleteMapping(SOCIETY_ID, MAPPING_ID);
    expect(res.success).toBe(true);
    expect(prismaMock.accountingCategoryMapping.delete).toHaveBeenCalledWith({
      where: { id: MAPPING_ID },
    });
  });
});

describe("seedDefaultMappings", () => {
  beforeEach(() => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
  });

  it("crée les mappings par défaut en skipping les doublons", async () => {
    prismaMock.accountingCategoryMapping.createMany.mockResolvedValue({
      count: 12,
    } as never);

    const res = await seedDefaultMappings(SOCIETY_ID);
    expect(res).toEqual({ success: true, data: { created: 12 } });
    expect(prismaMock.accountingCategoryMapping.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });
});
