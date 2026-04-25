import { describe, it, expect, vi } from "vitest";

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getDashboardStats, getBuildingPerformance, getDashboardAlerts } from "./dashboard";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("getDashboardStats", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getDashboardStats(SOCIETY_ID);
    expect(result).toBeNull();
  });

  it("retourne les statistiques agrégées", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);

    prismaMock.building.count.mockResolvedValue(3 as never);
    prismaMock.lot.count
      .mockResolvedValueOnce(10 as never) // lotCount
      .mockResolvedValueOnce(2 as never); // vacantLotCount
    prismaMock.lease.count.mockResolvedValue(8 as never);
    prismaMock.tenant.count.mockResolvedValue(12 as never);
    prismaMock.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { totalTTC: 5000 }, _count: 5 } as never) // monthInvoices
      .mockResolvedValueOnce({ _sum: { managementFeeTTC: 500 } } as never); // monthManagementFees
    prismaMock.invoice.count.mockResolvedValue(3 as never); // overdueInvoices
    prismaMock.lease.findMany.mockResolvedValue([] as never); // expiringLeases
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never); // expiringDiagnostics
    prismaMock.auditLog.findMany.mockResolvedValue([] as never); // recentAuditLogs

    const result = await getDashboardStats(SOCIETY_ID);
    expect(result).not.toBeNull();
    expect(result?.buildingCount).toBe(3);
    expect(result?.lotCount).toBe(10);
    expect(result?.vacantLotCount).toBe(2);
    expect(result?.activeLeaseCount).toBe(8);
    expect(result?.tenantCount).toBe(12);
    expect(result?.monthRevenueTTC).toBe(5000);
    expect(result?.monthInvoiceCount).toBe(5);
    expect(result?.overdueInvoiceCount).toBe(3);
    expect(result?.monthManagementFeesTTC).toBe(500);
    expect(result?.expiringLeases).toEqual([]);
    expect(result?.recentAuditLogs).toEqual([]);
  });

  it("utilise 0 comme valeur par défaut si les agrégats sont null", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);

    prismaMock.building.count.mockResolvedValue(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);
    prismaMock.lease.count.mockResolvedValue(0 as never);
    prismaMock.tenant.count.mockResolvedValue(0 as never);
    prismaMock.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { totalTTC: null }, _count: 0 } as never)
      .mockResolvedValueOnce({ _sum: { managementFeeTTC: null } } as never);
    prismaMock.invoice.count.mockResolvedValue(0 as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);

    const result = await getDashboardStats(SOCIETY_ID);
    expect(result?.monthRevenueTTC).toBe(0);
    expect(result?.monthManagementFeesTTC).toBe(0);
  });
});

describe("getBuildingPerformance", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getBuildingPerformance(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne un tableau vide si aucun immeuble", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.building.findMany.mockResolvedValue([] as never);

    const result = await getBuildingPerformance(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("calcule les métriques de performance par immeuble", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-1",
        name: "Immeuble A",
        city: "Paris",
        lots: [
          {
            id: "lot-1",
            status: "OCCUPE",
            area: 50,
            currentRent: 1200,
            marketRentValue: 1300,
            leases: [{ id: "lease-1", currentRentHT: 1000, startDate: new Date(), endDate: null, invoices: [{ totalTTC: 1200 }] }],
          },
          {
            id: "lot-2",
            status: "VACANT",
            area: 30,
            currentRent: 800,
            marketRentValue: null,
            leases: [],
          },
        ],
      },
    ] as never);

    const result = await getBuildingPerformance(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Immeuble A");
    expect(result[0].totalLots).toBe(2);
    expect(result[0].occupiedLots).toBe(1);
    expect(result[0].vacantLots).toBe(1);
    expect(result[0].vacancyRate).toBe(50);
    expect(result[0].monthlyRent).toBe(1000);
    expect(result[0].collectedRevenue).toBe(1200);
  });
});

describe("getDashboardAlerts", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getDashboardAlerts(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne un tableau vide si aucune alerte", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    // Toutes les requêtes retournent des tableaux vides ou 0
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([] as never);
    prismaMock.invoice.count.mockResolvedValue(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("retourne une alerte litigieuse et trie danger avant warning", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([] as never);
    prismaMock.invoice.count
      .mockResolvedValueOnce(0 as never) // draftCount
      .mockResolvedValueOnce(2 as never); // litigiousCount
    prismaMock.lot.count.mockResolvedValue(1 as never); // vacantLots → warning

    const result = await getDashboardAlerts(SOCIETY_ID);

    const litigiousAlert = result.find((a) => a.id === "invoices-litigious");
    expect(litigiousAlert).toBeDefined();
    expect(litigiousAlert?.type).toBe("danger");
    expect(litigiousAlert?.count).toBe(2);

    const vacantAlert = result.find((a) => a.id === "lots-vacant");
    expect(vacantAlert).toBeDefined();
    expect(vacantAlert?.type).toBe("warning");

    // Tri : danger avant warning
    const dangerIndex = result.findIndex((a) => a.type === "danger");
    const warningIndex = result.findIndex((a) => a.type === "warning");
    expect(dangerIndex).toBeLessThan(warningIndex);
  });

  it("retourne alerte loyers en retard par locataire et brouillons à valider", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([
      { tenantId: "tenant-1", _sum: { totalTTC: 1500 }, _count: 2 },
    ] as never);
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: "tenant-1", entityType: "PHYSIQUE", firstName: "Jean", lastName: "Dupont", companyName: null },
    ] as never);
    prismaMock.invoice.count
      .mockResolvedValueOnce(3 as never)  // draftCount
      .mockResolvedValueOnce(0 as never); // litigiousCount
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);

    const lateAlert = result.find((a) => a.id === "tenant-late-tenant-1");
    expect(lateAlert).toBeDefined();
    expect(lateAlert?.type).toBe("danger");
    expect(lateAlert?.count).toBe(2);

    const draftAlert = result.find((a) => a.id === "invoices-draft");
    expect(draftAlert).toBeDefined();
    expect(draftAlert?.type).toBe("info");
    expect(draftAlert?.count).toBe(3);
  });
});
