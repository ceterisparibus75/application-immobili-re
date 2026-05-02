import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { requireSocietyActionContext } = vi.hoisted(() => ({
  requireSocietyActionContext: vi.fn(),
}));
vi.mock("@/lib/action-society", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/action-society")>();
  return { ...actual, requireSocietyActionContext };
});

import { setAllocationKey, getOrCreateAllocationKey, deleteAllocationKey } from "./allocation-key";
import { createAuditLog } from "@/lib/audit";

const baseCategory = {
  id: "cat-1",
  societyId: "soc-1",
  buildingId: "building-1",
  name: "Eau",
  allocationMethod: "PERSONNALISE",
  nature: "RECUPERABLE",
  recoverableRate: 100,
  isGlobal: false,
  allocationKeys: [],
};

const baseLots = [
  { id: "lot-1", number: "A1", area: 50, commonShares: 200 },
  { id: "lot-2", number: "A2", area: 50, commonShares: 300 },
];

const existingKey = {
  id: "key-1",
  categoryId: "cat-1",
  method: "PERSONNALISE",
  category: { buildingId: "building-1" },
  entries: [
    { id: "entry-1", allocationKeyId: "key-1", lotId: "lot-1", percentage: 40, lot: { id: "lot-1", number: "A1", area: 50 } },
    { id: "entry-2", allocationKeyId: "key-1", lotId: "lot-2", percentage: 60, lot: { id: "lot-2", number: "A2", area: 50 } },
  ],
};

describe("setAllocationKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1" });
    prismaMock.chargeCategory.findFirst.mockResolvedValue(baseCategory as never);
    prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
    prismaMock.allocationKey.findFirst.mockResolvedValue(existingKey as never);
    prismaMock.allocationKey.update.mockResolvedValue(existingKey as never);
    prismaMock.allocationKey.create.mockResolvedValue(existingKey as never);
    prismaMock.allocationKeyEntry.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.allocationKeyEntry.createMany.mockResolvedValue({ count: 2 });
  });

  it("retourne une erreur si l'auth echoue", async () => {
    requireSocietyActionContext.mockRejectedValue(new Error("Acces refuse"));
    const result = await setAllocationKey("soc-1", {
      categoryId: "cat-1",
      entries: [{ lotId: "lot-1", percentage: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la categorie est introuvable", async () => {
    prismaMock.chargeCategory.findFirst.mockResolvedValue(null);
    const result = await setAllocationKey("soc-1", {
      categoryId: "cat-1",
      entries: [{ lotId: "lot-1", percentage: 100 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si la somme des pourcentages n'est pas 100", async () => {
    const result = await setAllocationKey("soc-1", {
      categoryId: "cat-1",
      entries: [
        { lotId: "lot-1", percentage: 40 },
        { lotId: "lot-2", percentage: 40 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("100");
  });

  it("cree ou met a jour la cle de repartition avec succes", async () => {
    const result = await setAllocationKey("soc-1", {
      categoryId: "cat-1",
      entries: [
        { lotId: "lot-1", percentage: 40 },
        { lotId: "lot-2", percentage: 60 },
      ],
    });
    expect(result.success).toBe(true);
    expect(prismaMock.allocationKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { method: "PERSONNALISE" },
    });
    expect(prismaMock.allocationKeyEntry.deleteMany).toHaveBeenCalled();
    expect(prismaMock.allocationKeyEntry.createMany).toHaveBeenCalled();
  });

  it("cree la cle de repartition si elle n'existe pas encore", async () => {
    prismaMock.allocationKey.findFirst.mockResolvedValue(null);

    const result = await setAllocationKey("soc-1", {
      categoryId: "cat-1",
      entries: [
        { lotId: "lot-1", percentage: 40 },
        { lotId: "lot-2", percentage: 60 },
      ],
    });

    expect(result.success).toBe(true);
    expect(prismaMock.allocationKey.create).toHaveBeenCalledWith({
      data: { categoryId: "cat-1", method: "PERSONNALISE" },
    });
  });

  it("cree un audit log SET_ALLOCATION_KEY", async () => {
    await setAllocationKey("soc-1", {
      categoryId: "cat-1",
      entries: [
        { lotId: "lot-1", percentage: 40 },
        { lotId: "lot-2", percentage: 60 },
      ],
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ event: "SET_ALLOCATION_KEY" }),
      })
    );
  });
});

describe("getOrCreateAllocationKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1" });
  });

  it("retourne la cle existante si elle existe", async () => {
    prismaMock.allocationKey.findFirst.mockResolvedValue(existingKey as never);
    const result = await getOrCreateAllocationKey("soc-1", "cat-1");
    expect(result.success).toBe(true);
    expect(result.data?.entries).toHaveLength(2);
  });

  it("retourne une liste vide si aucune cle n'existe", async () => {
    prismaMock.allocationKey.findFirst.mockResolvedValue(null);
    prismaMock.lot.findMany.mockResolvedValue(baseLots as never);
    const result = await getOrCreateAllocationKey("soc-1", "cat-1");
    expect(result.success).toBe(true);
    expect(result.data?.entries).toHaveLength(2);
    expect(result.data?.entries[0]?.percentage).toBe(0);
  });
});

describe("deleteAllocationKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1" });
    prismaMock.chargeCategory.findFirst.mockResolvedValue(baseCategory as never);
    prismaMock.allocationKey.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("supprime la cle de repartition et retourne success", async () => {
    const result = await deleteAllocationKey("soc-1", "cat-1");
    expect(result.success).toBe(true);
    expect(prismaMock.allocationKey.deleteMany).toHaveBeenCalledWith({
      where: { categoryId: "cat-1" },
    });
  });
});

