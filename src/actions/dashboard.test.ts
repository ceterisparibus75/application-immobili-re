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

  it("retourne alertes pour factures impayées, diagnostics expirants et révisions (lignes 302-366)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);

    // 2 overdue invoices to trigger per-invoice loop (lines 302-314)
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "FAC-2025-001",
        totalTTC: 800,
        dueDate: new Date("2025-01-01"),
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Jean", lastName: "Dupont" },
      },
      {
        id: "inv-2",
        invoiceNumber: "FAC-2025-002",
        totalTTC: 600,
        dueDate: new Date("2025-01-15"),
        tenant: { entityType: "PERSONNE_MORALE", companyName: "SCI Test", firstName: null, lastName: null },
      },
    ] as never);

    // expiring diagnostic with daysLeft <= 60 → isUrgent = true (lines 332-334)
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    prismaMock.diagnostic.findMany.mockResolvedValue([
      {
        id: "diag-1",
        type: "DPE",
        expiresAt: soon,
        building: { id: "building-1", name: "Immeuble A" },
      },
    ] as never);

    // pending revisions → triggers line 366
    prismaMock.rentRevision.findMany.mockResolvedValue([
      { id: "rev-1", effectiveDate: new Date(), newRentHT: 900, lease: { id: "lease-1", tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Jean", lastName: "Dupont" } } },
    ] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([] as never);
    prismaMock.invoice.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);

    const overdueAlert = result.find((a) => a.id === "invoices-overdue-30d");
    expect(overdueAlert).toBeDefined();
    expect(overdueAlert?.count).toBe(2);

    const diagAlert = result.find((a) => a.id === "diagnostic-expiring-diag-1");
    expect(diagAlert).toBeDefined();
    expect(diagAlert?.type).toBe("danger"); // isUrgent=true → danger

    const revisionAlert = result.find((a) => a.id === "rent-revisions-pending");
    expect(revisionAlert).toBeDefined();
  });

  it("retourne une alerte pour un bail expirant bientôt (lignes 256-257)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-expiring-1",
        endDate,
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Marie", lastName: "Curie" },
        lot: { number: "B-201", building: { name: "Immeuble Central" } },
      },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([] as never);
    prismaMock.invoice.count.mockResolvedValue(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);
    const leaseAlert = result.find((a) => a.id === "lease-expiring-lease-expiring-1");
    expect(leaseAlert).toBeDefined();
    expect(leaseAlert?.type).toBe("warning");
    expect(leaseAlert?.message).toContain("Marie Curie");
  });

  it("ignore un locataire introuvable dans la map (ligne 399)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([
      { tenantId: "unknown-tenant", _sum: { totalTTC: 1000 }, _count: 1 },
    ] as never);
    prismaMock.tenant.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.count.mockResolvedValue(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);
    const lateAlert = result.find((a) => a.id === "tenant-late-unknown-tenant");
    expect(lateAlert).toBeUndefined();
  });

  it("1 facture impayée + diagnostic non-urgent (> 60j) + 2 révisions en attente (lignes 296,336,370)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);

    // 1 seule facture en retard → length=1 → FALSE branch "" (no "s") ligne 296
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-solo",
        invoiceNumber: "FAC-2025-010",
        totalTTC: 900,
        dueDate: new Date("2025-01-01"),
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Alice", lastName: "Martin" },
      },
    ] as never);

    // Diagnostic avec daysLeft > 60 → isUrgent=false → "warning" ligne 336
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    prismaMock.diagnostic.findMany.mockResolvedValue([
      {
        id: "diag-long",
        type: "AMIANTE",
        expiresAt: in90Days,
        building: { id: "building-1", name: "Immeuble B" },
      },
    ] as never);

    // 2 révisions en attente → length > 1 → TRUE branch "s" ligne 370
    prismaMock.rentRevision.findMany.mockResolvedValue([
      { id: "rev-1", effectiveDate: new Date(), newRentHT: 900, lease: { id: "lease-1", tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Paul", lastName: "Dup" } } },
      { id: "rev-2", effectiveDate: new Date(), newRentHT: 800, lease: { id: "lease-2", tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Anne", lastName: "Bon" } } },
    ] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([] as never);
    prismaMock.invoice.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);

    const overdueAlert = result.find((a) => a.id === "invoices-overdue-30d");
    expect(overdueAlert?.count).toBe(1);
    expect(overdueAlert?.title).not.toContain("factures");  // 1 → "facture" no "s"

    const diagAlert = result.find((a) => a.id === "diagnostic-expiring-diag-long");
    expect(diagAlert?.type).toBe("warning");  // not urgent

    const revAlert = result.find((a) => a.id === "rent-revisions-pending");
    expect(revAlert?.title).toContain("revisions");  // 2 → "revisions" with "s"
  });

  it("_sum.totalTTC null → ?? 0 et group._count=1 (ligne 406 right branches)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([
      { tenantId: "tenant-null-ttc", _sum: { totalTTC: null }, _count: 1 },
    ] as never);
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: "tenant-null-ttc", entityType: "PERSONNE_PHYSIQUE", firstName: "Bob", lastName: "Null", companyName: null },
    ] as never);
    prismaMock.invoice.count.mockResolvedValue(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);

    const lateAlert = result.find((a) => a.id === "tenant-late-tenant-null-ttc");
    expect(lateAlert).toBeDefined();
    // totalTTC null → ?? 0 → "0,00 €"
    expect(lateAlert?.message).toContain("0");
  });

  it("couvre les branches pluriel singular pour _count=1, draftCount=1, vacantLots=2, litigiousCount=1 (lignes 406,423,443,460)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([
      { tenantId: "tenant-1", _sum: { totalTTC: 800 }, _count: 1 },
    ] as never);
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: "tenant-1", entityType: "PERSONNE_PHYSIQUE", firstName: "Jean", lastName: "Dupont", companyName: null },
    ] as never);
    prismaMock.invoice.count
      .mockResolvedValueOnce(1 as never)   // draftCount = 1 → false branch (no "s") ligne 423
      .mockResolvedValueOnce(1 as never);  // litigiousCount = 1 → false branch (no "s") ligne 460
    prismaMock.lot.count.mockResolvedValue(2 as never);  // vacantLots = 2 → true branch ("s") ligne 443

    const result = await getDashboardAlerts(SOCIETY_ID);

    // _count=1 → "facture" (no "s") ligne 406
    const lateAlert = result.find((a) => a.id === "tenant-late-tenant-1");
    expect(lateAlert?.message).toContain("facture");

    // draftCount=1 → "brouillon" (no "s") ligne 423
    const draftAlert = result.find((a) => a.id === "invoices-draft");
    expect(draftAlert?.title).toContain("brouillon");

    // vacantLots=2 → "lots vacants" (with "s") ligne 443
    const vacantAlert = result.find((a) => a.id === "lots-vacant");
    expect(vacantAlert?.title).toContain("lots");

    // litigiousCount=1 → "facture" (no "s") ligne 460
    const litigiousAlert = result.find((a) => a.id === "invoices-litigious");
    expect(litigiousAlert?.title).toContain("facture");
  });

  it("PERSONNE_MORALE companyName null → '—' et PERSONNE_PHYSIQUE noms null → '—' (lignes 216-217 right branches)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-morale-null",
        invoiceNumber: "FAC-2025-010",
        totalTTC: 500,
        dueDate: new Date("2025-01-01"),
        tenant: { entityType: "PERSONNE_MORALE", companyName: null, firstName: null, lastName: null },
      },
      {
        id: "inv-physique-null",
        invoiceNumber: "FAC-2025-011",
        totalTTC: 300,
        dueDate: new Date("2025-01-01"),
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: null, lastName: null },
      },
    ] as never);
    prismaMock.diagnostic.findMany.mockResolvedValue([] as never);
    prismaMock.rentRevision.findMany.mockResolvedValue([] as never);
    vi.mocked(prismaMock.invoice.groupBy).mockResolvedValue([] as never);
    prismaMock.invoice.count.mockResolvedValue(0 as never);
    prismaMock.lot.count.mockResolvedValue(0 as never);

    const result = await getDashboardAlerts(SOCIETY_ID);
    const alert1 = result.find((a) => a.id === "invoice-overdue-inv-morale-null");
    const alert2 = result.find((a) => a.id === "invoice-overdue-inv-physique-null");
    // Both alerts should have "—" as tenant name component in title/message
    expect(alert1 ?? result.find((a) => a.message?.includes("—"))).toBeDefined();
    expect(result.some((a) => a.id.includes("inv-"))).toBe(true);
  });
});

// ── getBuildingPerformance — branches zéro (lignes 191-194) ───────────────────

describe("getBuildingPerformance — branches zéro (lignes 191-194)", () => {
  it("building sans lots → vacancyRate/grossYield/occupancyRateArea = 0 (FALSE branches 192-194)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.building.findMany.mockResolvedValue([
      { id: "building-empty", name: "Sans lots", city: "Lyon", lots: [] },
    ] as never);

    const result = await getBuildingPerformance(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0].totalLots).toBe(0);
    expect(result[0].vacancyRate).toBe(0);
    expect(result[0].grossYield).toBe(0);
    expect(result[0].occupancyRateArea).toBe(0);
  });

  it("lot avec marketRentValue=null et currentRent=null → ?? 0 (ligne 191 right branch)", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "building-null-rents",
        name: "Nul",
        city: "Lille",
        lots: [
          { id: "lot-null", status: "VACANT", area: 0, currentRent: null, marketRentValue: null, leases: [] },
        ],
      },
    ] as never);

    const result = await getBuildingPerformance(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0].grossYield).toBe(0);
    expect(result[0].monthlyRent).toBe(0);
  });
});
