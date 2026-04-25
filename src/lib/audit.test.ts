import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/audit", async (importOriginal) => {
  return await importOriginal();
});

import { prismaMock } from "@/test/mocks/prisma";
import { createAuditLog, getAuditLogs, getAuditLogsForExport } from "./audit";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const USER_ID = "clh3x2z4k0001qh8g7z1y2v3u";

describe("createAuditLog", () => {
  it("crée une entrée d'audit avec les paramètres fournis", async () => {
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    await createAuditLog({
      societyId: SOCIETY_ID,
      userId: USER_ID,
      action: "CREATE",
      entity: "Lot",
      entityId: "lot-001",
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: SOCIETY_ID,
        userId: USER_ID,
        action: "CREATE",
        entity: "Lot",
        entityId: "lot-001",
      }),
    });
  });

  it("inclut les details si fournis", async () => {
    prismaMock.auditLog.create.mockResolvedValue({} as never);

    await createAuditLog({
      societyId: SOCIETY_ID,
      action: "UPDATE",
      entity: "Invoice",
      entityId: "inv-001",
      details: { amount: 1200 },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: { amount: 1200 } }),
    });
  });

  it("ne lève pas d'exception si Prisma échoue (audit silencieux)", async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createAuditLog({ societyId: SOCIETY_ID, action: "DELETE", entity: "Tenant", entityId: "t-001" })
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});

describe("getAuditLogs", () => {
  const fakeLogs = [
    { id: "log-1", entity: "Invoice", entityId: "inv-001", action: "CREATE", createdAt: new Date(), user: null },
  ];

  it("retourne les logs paginés avec total", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue(fakeLogs as never);
    prismaMock.auditLog.count.mockResolvedValue(1);

    const result = await getAuditLogs(SOCIETY_ID);

    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(50);
    expect(result.totalPages).toBe(1);
  });

  it("calcule totalPages correctement", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(125);

    const result = await getAuditLogs(SOCIETY_ID, { perPage: 50 });

    expect(result.totalPages).toBe(3);
  });

  it("filtre par entity si fourni", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0);

    await getAuditLogs(SOCIETY_ID, { entity: "Lot" });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entity: "Lot" }),
      })
    );
  });

  it("filtre par userId si fourni", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0);

    await getAuditLogs(SOCIETY_ID, { userId: USER_ID });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });

  it("applique la pagination via skip/take", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(100);

    await getAuditLogs(SOCIETY_ID, { page: 3, perPage: 10 });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it("ajoute un filtre OR si search est fourni", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0);

    await getAuditLogs(SOCIETY_ID, { search: "Alice" });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ entity: expect.objectContaining({ contains: "Alice" }) }),
          ]),
        }),
      })
    );
  });

  it("filtre par startDate et endDate si fournis", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0);

    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-04-30");
    await getAuditLogs(SOCIETY_ID, { startDate, endDate });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: startDate, lte: endDate },
        }),
      })
    );
  });
});

describe("getAuditLogsForExport", () => {
  it("retourne tous les logs sans pagination (limit 10000)", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([
      { id: "log-1", entity: "Invoice", entityId: "inv-001", action: "CREATE" },
    ] as never);

    const result = await getAuditLogsForExport(SOCIETY_ID);

    expect(result).toHaveLength(1);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10000 })
    );
  });

  it("filtre par entity et action si fournis", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    await getAuditLogsForExport(SOCIETY_ID, { entity: "Tenant", action: "DELETE" });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entity: "Tenant", action: "DELETE" }),
      })
    );
  });

  it("ajoute un filtre OR si search est fourni dans l'export", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    await getAuditLogsForExport(SOCIETY_ID, { search: "Bob" });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ entity: expect.objectContaining({ contains: "Bob" }) }),
          ]),
        }),
      })
    );
  });
});
