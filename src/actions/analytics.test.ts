import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn().mockImplementation((fn: () => unknown) => fn),
}));
vi.mock("@/lib/utils", () => ({
  buildLenderMapping: vi.fn().mockReturnValue(new Map()),
  cn: vi.fn(),
  formatCurrency: vi.fn(),
  formatDate: vi.fn(),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { getAnalyticsData, getConsolidatedAnalyticsData } from "./analytics";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";

describe("getAnalyticsData", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getAnalyticsData(SOCIETY_ID);
    expect(result).toBeNull();
  });
});

describe("getConsolidatedAnalyticsData", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getConsolidatedAnalyticsData();
    expect(result).toBeNull();
  });

  it("retourne null si aucune société trouvée pour le propriétaire", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.society.findMany.mockResolvedValue([]);

    const result = await getConsolidatedAnalyticsData();
    expect(result).toBeNull();
  });
});

// ─── fetchAnalyticsCore (via getAnalyticsData) ───────────────────────────────

const S = SOCIETY_ID;

/**
 * Sets up the exact sequence of Prisma mock calls expected by fetchAnalyticsCore.
 * Order matters: calls happen synchronously in source order before the big Promise.all.
 */
function setupCoreMocks({
  includeTopTenants = false,
  monthlyRaw = [] as Array<{ month: Date; revenue: number }>,
  topTenantsRaw = [] as Array<{ tenantId: string; total: number; companyName: string | null; firstName: string | null; lastName: string | null; entityType: string }>,
  currentMonthTTC = null as number | null,
  prevMonthTTC = null as number | null,
  buildingsRaw = [] as Array<{ name: string; lots: Array<{ status: string }> }>,
  overdueInvoices = [] as Array<{ totalTTC: number; dueDate: Date }>,
  buildingsForPatrimony = [] as Array<{ id: string; acquisitionDate: Date | null; marketValue: number | null; acquisitionPrice: number | null; acquisitionFees: number | null; acquisitionTaxes: number | null; acquisitionOtherCosts: number | null; worksCost: number | null; additionalAcquisitions: Array<{ acquisitionPrice: number | null; acquisitionFees: number | null; acquisitionTaxes: number | null; otherCosts: number | null }> }>,
  latestValuations = [] as Array<{ buildingId: string; estimatedValueMid: number | null }>,
  riskLeases = [] as Array<unknown>,
  activeLeases = [] as Array<unknown>,
  bankBalance = null as number | null,
  expiringLeaseCount = 0,
  activeLeasesForRent = [] as Array<{ currentRentHT: number }>,
  recoverableCharges = null as number | null,
  loans = [] as Array<unknown>,
  totalBuildings = 0,
  totalTenants = 0,
  activeLeaseCount = 0,
  expiringDiagnosticCount = 0,
  openMaintenanceCount = 0,
  unpaidInvoiceCount = 0,
  managementFeesTTC = null as number | null,
  pendingRevisionCount = 0,
  leasesWithCurrentInvoice = [] as Array<{ leaseId: string | null }>,
  invoicesToIssueCount = 0,
} = {}) {
  // $queryRaw #1: monthly revenue; #2: top tenants (only if includeTopTenants)
  const qrMock = prismaMock.$queryRaw.mockResolvedValueOnce(monthlyRaw as never);
  if (includeTopTenants) qrMock.mockResolvedValueOnce(topTenantsRaw as never);

  // invoice.aggregate: #1 currentMonth, #2 prevMonth, #3 managementFees
  prismaMock.invoice.aggregate
    .mockResolvedValueOnce({ _sum: { totalTTC: currentMonthTTC } } as never)
    .mockResolvedValueOnce({ _sum: { totalTTC: prevMonthTTC } } as never)
    .mockResolvedValueOnce({ _sum: { managementFeeTTC: managementFeesTTC } } as never);

  // building.findMany: #1 buildingsRaw, #2 buildingsForPatrimony
  prismaMock.building.findMany
    .mockResolvedValueOnce(buildingsRaw as never)
    .mockResolvedValueOnce(buildingsForPatrimony as never);

  // invoice.findMany: #1 overdueInvoices, #2 leasesWithCurrentInvoice
  prismaMock.invoice.findMany
    .mockResolvedValueOnce(overdueInvoices as never)
    .mockResolvedValueOnce(leasesWithCurrentInvoice as never);

  prismaMock.propertyValuation.findMany.mockResolvedValueOnce(latestValuations as never);

  // lease.findMany: #1 riskLeases, #2 activeLeases, #3 activeLeasesForRent
  prismaMock.lease.findMany
    .mockResolvedValueOnce(riskLeases as never)
    .mockResolvedValueOnce(activeLeases as never)
    .mockResolvedValueOnce(activeLeasesForRent as never);

  prismaMock.bankAccount.aggregate.mockResolvedValueOnce({ _sum: { currentBalance: bankBalance } } as never);

  // lease.count: #1 expiring, #2 active (in dashboardCounts), #3 invoicesToIssue (after Promise.all)
  prismaMock.lease.count
    .mockResolvedValueOnce(expiringLeaseCount)
    .mockResolvedValueOnce(activeLeaseCount)
    .mockResolvedValueOnce(invoicesToIssueCount);

  prismaMock.charge.aggregate.mockResolvedValueOnce({ _sum: { amount: recoverableCharges } } as never);
  prismaMock.loan.findMany.mockResolvedValueOnce(loans as never);

  // dashboardCounts order: building.count, tenant.count, lease.count, diagnostic.count, maintenance.count, invoice.count
  prismaMock.building.count.mockResolvedValueOnce(totalBuildings);
  prismaMock.tenant.count.mockResolvedValueOnce(totalTenants);
  prismaMock.diagnostic.count.mockResolvedValueOnce(expiringDiagnosticCount);
  prismaMock.maintenance.count.mockResolvedValueOnce(openMaintenanceCount);
  prismaMock.invoice.count.mockResolvedValueOnce(unpaidInvoiceCount);
  prismaMock.rentRevision.count.mockResolvedValueOnce(pendingRevisionCount);
}

describe("fetchAnalyticsCore — via getAnalyticsData", () => {
  beforeEach(() => {
    mockAuthSession("GESTIONNAIRE", S);
  });

  it("retourne les KPIs à zéro quand toutes les données sont vides (fallbacks ??)", async () => {
    setupCoreMocks();
    const result = await getAnalyticsData(S);
    expect(result).not.toBeNull();
    expect(result!.kpis.currentMonthRevenue).toBe(0);
    expect(result!.kpis.prevMonthRevenue).toBe(0);
    expect(result!.kpis.revenueChange).toBe(0); // both zero → 0
    expect(result!.kpis.occupancyRate).toBe(0); // totalLots=0 → 0
    expect(result!.kpis.grossYield).toBeNull(); // totalPatrimony=0 → null
    expect(result!.kpis.ltv).toBeNull(); // totalCostForLtv=0 → null
    expect(result!.kpis.availableCash).toBe(0); // bankBalance null → 0
    expect(result!.kpis.recoverableCharges).toBe(0);
    expect(result!.kpis.totalManagementFees).toBe(0);
    expect(result!.topTenants).toEqual([]);
    expect(result!.patrimonyPoints).toEqual([]);
  });

  it("revenueChange = 100 si prevMonth=0 et currentMonth>0 (B: prevMonth=0 arm1, currentMonth>0 arm0)", async () => {
    setupCoreMocks({ currentMonthTTC: 500, prevMonthTTC: null });
    const result = await getAnalyticsData(S);
    expect(result!.kpis.currentMonthRevenue).toBe(500);
    expect(result!.kpis.prevMonthRevenue).toBe(0);
    expect(result!.kpis.revenueChange).toBe(100);
  });

  it("revenueChange calculé si prevMonth>0 (B: prevMonthRevenue>0 arm0)", async () => {
    setupCoreMocks({ currentMonthTTC: 1200, prevMonthTTC: 1000 });
    const result = await getAnalyticsData(S);
    expect(result!.kpis.revenueChange).toBe(20); // (1200-1000)/1000 * 100 = 20
  });

  it("tronque le nom d'immeuble > 22 chars et calcule l'occupation (B: name>22 arm0, totalLots>0)", async () => {
    setupCoreMocks({
      buildingsRaw: [
        { name: "Immeuble Les Acacias de Versailles", lots: [{ status: "OCCUPE" }, { status: "LIBRE" }] },
        { name: "Appt Paris 15e", lots: [{ status: "OCCUPE" }] },
      ],
    });
    const result = await getAnalyticsData(S);
    expect(result!.buildingOccupancy[0].name).toBe("Immeuble Les Acacias…"); // truncated (slice 0,20 + …)
    expect(result!.buildingOccupancy[1].name).toBe("Appt Paris 15e"); // kept as-is
    expect(result!.kpis.occupancyRate).toBe(67); // 2 occupés / 3 totaux
    expect(result!.kpis.totalLots).toBe(3);
    expect(result!.kpis.occupiedLots).toBe(2);
  });

  it("monthlyRevenue utilise la valeur de la map si présente (??  0 arm0)", async () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    setupCoreMocks({ monthlyRaw: [{ month: d, revenue: 1500 }] });
    const result = await getAnalyticsData(S);
    const lastMonth = result!.monthlyRevenue[11]; // dernier mois = mois courant
    expect(lastMonth.revenue).toBe(1500);
  });

  it("displayTenantName — PERSONNE_MORALE avec companyName (arm0) et null (arm1)", async () => {
    setupCoreMocks({
      includeTopTenants: true,
      topTenantsRaw: [
        { tenantId: "t1", total: 1000, entityType: "PERSONNE_MORALE", companyName: "SARL Dupont", firstName: null, lastName: null },
        { tenantId: "t2", total: 800, entityType: "PERSONNE_MORALE", companyName: null, firstName: null, lastName: null },
      ],
    });
    const result = await getAnalyticsData(S, { includeTopTenants: true });
    expect(result!.topTenants[0].name).toBe("SARL Dupont");
    expect(result!.topTenants[1].name).toBe("—"); // companyName null → "—"
  });

  it("displayTenantName — PERSONNE_PHYSIQUE avec noms (arm0) et sans noms (arm1='')", async () => {
    const makeTenant = (firstName: string | null, lastName: string | null) => ({
      entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName, lastName,
    });
    const makeLease = (tenant: unknown) => ({
      currentRentHT: 500, paymentFrequency: "MENSUEL",
      tenant,
      lot: { building: { name: "Bat A" } },
    });
    setupCoreMocks({
      riskLeases: [
        makeLease(makeTenant("Jean", "Dupont")),
        makeLease(makeTenant(null, null)),
      ],
    });
    const result = await getAnalyticsData(S);
    const byTenant = result!.riskConcentration.byTenant;
    const names = byTenant.map((t) => t.name);
    expect(names).toContain("Jean Dupont");
    expect(names).toContain("—"); // trim("") || "—"
  });

  it("FREQ_MULT[frequency] ?? 12 — fréquence inconnue utilise le fallback 12", async () => {
    setupCoreMocks({
      riskLeases: [{
        currentRentHT: 100, paymentFrequency: "HEBDOMADAIRE", // inconnue
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "A", lastName: "B" },
        lot: { building: { name: "Bat" } },
      }],
    });
    const result = await getAnalyticsData(S);
    // annual = 100 * 12 = 1200 (fallback 12)
    const byBuilding = result!.riskConcentration.byBuilding;
    expect(byBuilding[0].annualRent).toBe(1200);
  });

  it("totalAnnualRentRisk=0 → pct=0 pour tous les items de riskConcentration", async () => {
    setupCoreMocks({
      riskLeases: [{
        currentRentHT: 0, paymentFrequency: "MENSUEL",
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "A", lastName: "B" },
        lot: { building: { name: "Bat" } },
      }],
    });
    const result = await getAnalyticsData(S);
    expect(result!.riskConcentration.byBuilding[0].pct).toBe(0);
    expect(result!.riskConcentration.byTenant[0].pct).toBe(0);
  });

  it("patrimony — building sans acquisitionDate pousse 'Actuel' si cumulative>0 (B: length=0 && cumulative>0)", async () => {
    setupCoreMocks({
      buildingsForPatrimony: [{
        id: "b1", acquisitionDate: null, marketValue: 200000, acquisitionPrice: null,
        acquisitionFees: null, acquisitionTaxes: null, acquisitionOtherCosts: null, worksCost: null,
        additionalAcquisitions: [],
      }],
    });
    const result = await getAnalyticsData(S);
    expect(result!.patrimonyPoints).toHaveLength(1);
    expect(result!.patrimonyPoints[0].date).toBe("Actuel");
    expect(result!.patrimonyPoints[0].value).toBe(200000);
    expect(result!.kpis.grossYield).not.toBeNull(); // totalPatrimony>0
  });

  it("patrimony — aiValue prioritaire sur marketValue, marketValue sur acquisitionPrice", async () => {
    setupCoreMocks({
      buildingsForPatrimony: [
        {
          id: "b-with-ai", acquisitionDate: new Date("2020-01-01"), marketValue: 100000,
          acquisitionPrice: null, acquisitionFees: null, acquisitionTaxes: null,
          acquisitionOtherCosts: null, worksCost: null, additionalAcquisitions: [],
        },
        {
          id: "b-market-only", acquisitionDate: new Date("2021-01-01"), marketValue: 150000,
          acquisitionPrice: null, acquisitionFees: null, acquisitionTaxes: null,
          acquisitionOtherCosts: null, worksCost: null, additionalAcquisitions: [],
        },
        {
          id: "b-acq-only", acquisitionDate: new Date("2022-01-01"), marketValue: null,
          acquisitionPrice: 90000, acquisitionFees: null, acquisitionTaxes: null,
          acquisitionOtherCosts: null, worksCost: null, additionalAcquisitions: [],
        },
      ],
      latestValuations: [{ buildingId: "b-with-ai", estimatedValueMid: 180000 }],
    });
    const result = await getAnalyticsData(S);
    // b-with-ai: aiValue=180000 (prime sur marketValue 100000); b-market-only: marketValue=150000; b-acq-only: acquisitionPrice=90000
    expect(result!.kpis.patrimonyValue).toBe(180000 + 150000 + 90000);
    // totalCostForLtv: b-with-ai=0, b-market-only=0, b-acq-only=90000 → ltv not null
    expect(result!.kpis.ltv).not.toBeNull();
  });

  it("patrimony — ltv calculé si totalCostForLtv>0 (B: totalCostForLtv>0 arm0)", async () => {
    setupCoreMocks({
      buildingsForPatrimony: [{
        id: "b1", acquisitionDate: null, marketValue: null, acquisitionPrice: 100000,
        acquisitionFees: 10000, acquisitionTaxes: 5000, acquisitionOtherCosts: null, worksCost: null,
        additionalAcquisitions: [{ acquisitionPrice: 20000, acquisitionFees: 1000, acquisitionTaxes: 500, otherCosts: null }],
      }],
      loans: [{
        id: "l1", amount: 80000, purchaseValue: null, lender: null,
        amortizationLines: [{ remainingBalance: 60000, totalPayment: 800 }],
      }],
    });
    const result = await getAnalyticsData(S);
    // totalCostForLtv = 100000+10000+5000 + 20000+1000+500 = 136500
    const expectedLtv = Math.round((60000 / 136500) * 1000) / 10;
    expect(result!.kpis.ltv).toBe(expectedLtv);
    expect(result!.kpis.totalDebt).toBe(60000);
    expect(result!.kpis.monthlyLoanPayment).toBe(800);
  });

  it("loan sans amortizationLines → utilise loan.amount pour la dette (B: lines.length=0 arm1)", async () => {
    setupCoreMocks({
      loans: [{
        id: "l2", amount: 50000, purchaseValue: null, lender: "Crédit Mutuel",
        amortizationLines: [],
      }],
    });
    const result = await getAnalyticsData(S);
    expect(result!.kpis.totalDebt).toBe(50000);
    expect(result!.kpis.monthlyLoanPayment).toBe(0); // pas de line → pas ajouté
    expect(result!.lenderSummaries).toHaveLength(1);
    // lender: lenderNameMapping.get("Crédit Mutuel") = undefined → ?? rawName = "Crédit Mutuel"
    expect(result!.lenderSummaries[0].lender).toBe("Crédit Mutuel");
  });

  it("loan.lender null → 'Autre' comme rawName (B: l.lender || 'Autre')", async () => {
    setupCoreMocks({
      loans: [{
        id: "l3", amount: 30000, purchaseValue: null, lender: null,
        amortizationLines: [],
      }],
    });
    const result = await getAnalyticsData(S);
    expect(result!.lenderSummaries[0].lender).toBe("Autre");
  });

  it("leaseIdsWithInvoice.size>0 → ajoute le filtre notIn (B arm0)", async () => {
    setupCoreMocks({ leasesWithCurrentInvoice: [{ leaseId: "lease-abc" }], invoicesToIssueCount: 0 });
    const result = await getAnalyticsData(S);
    expect(result).not.toBeNull();
    // Vérifie que lease.count a bien été appelé (3e appel = invoicesToIssue)
    const calls = prismaMock.lease.count.mock.calls;
    const lastCall = calls[calls.length - 1][0] as { where?: { id?: unknown } };
    expect(lastCall?.where).toHaveProperty("id.notIn");
  });

  it("leaseTimeline — progressPct=0 si endDate<=startDate (B: end>start arm1)", async () => {
    const d = "2024-01-01";
    setupCoreMocks({
      activeLeases: [{
        id: "l1", startDate: d, endDate: d,
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "A", lastName: "B" },
        lot: { number: "1", building: { name: "Bat" } },
      }],
    });
    const result = await getAnalyticsData(S);
    expect(result!.leaseTimeline[0].progressPct).toBe(0);
  });

  it("monthlyRevenue — valeurs positives dans rawMonthly sont bien agrégées (map.get arm0)", async () => {
    const now = new Date();
    const d11 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    setupCoreMocks({ monthlyRaw: [{ month: d11, revenue: 999 }] });
    const result = await getAnalyticsData(S);
    expect(result!.monthlyRevenue[0].revenue).toBe(999);
  });

  it("inclut les KPI de gestion tiers et révisions en attente", async () => {
    setupCoreMocks({ managementFeesTTC: 350, pendingRevisionCount: 2, totalBuildings: 5, totalTenants: 10 });
    const result = await getAnalyticsData(S);
    expect(result!.kpis.totalManagementFees).toBe(350);
    expect(result!.kpis.pendingRevisionCount).toBe(2);
    expect(result!.kpis.totalBuildings).toBe(5);
    expect(result!.kpis.totalTenants).toBe(10);
  });

  it("overdueByAge — classer les factures en 4 tranches d'ancienneté (B lignes 284-285)", async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
    setupCoreMocks({
      overdueInvoices: [
        { totalTTC: 100, dueDate: daysAgo(15) },   // < 30 j
        { totalTTC: 200, dueDate: daysAgo(45) },   // 30-60 j
        { totalTTC: 300, dueDate: daysAgo(75) },   // 60-90 j
        { totalTTC: 400, dueDate: daysAgo(120) },  // > 90 j
      ],
    });
    const result = await getAnalyticsData(S);
    expect(result!.overdueByAge[0].label).toBe("< 30 j");
    expect(result!.overdueByAge[0].amount).toBe(100);
    expect(result!.overdueByAge[3].label).toBe("> 90 j");
    expect(result!.overdueByAge[3].amount).toBe(400);
  });

  it("lenderSummaries trié par remainingBalance desc — sort comparateur (B ligne 430)", async () => {
    setupCoreMocks({
      loans: [
        { id: "l1", amount: 50000, purchaseValue: null, lender: "BNP", amortizationLines: [{ remainingBalance: 30000, totalPayment: 500 }] },
        { id: "l2", amount: 80000, purchaseValue: null, lender: "LCL", amortizationLines: [{ remainingBalance: 70000, totalPayment: 900 }] },
      ],
    });
    const result = await getAnalyticsData(S);
    expect(result!.lenderSummaries).toHaveLength(2);
    // LCL a remainingBalance=70000 > BNP 30000 → LCL en premier
    expect(result!.lenderSummaries[0].lender).toBe("LCL");
    expect(result!.lenderSummaries[1].lender).toBe("BNP");
  });
});

describe("getConsolidatedAnalyticsData — avec proprietaireId (B: proprietaireId arm0)", () => {
  it("utilise le filtre proprietaireId si fourni", async () => {
    mockAuthSession("GESTIONNAIRE", S);
    prismaMock.society.findMany.mockResolvedValue([{ id: S } as never]);

    setupCoreMocks();

    const result = await getConsolidatedAnalyticsData("proprio-1");
    expect(result).not.toBeNull();
    const societyCall = prismaMock.society.findMany.mock.calls[0][0] as { where?: unknown };
    expect(societyCall?.where).toHaveProperty("proprietaireId", "proprio-1");
  });

  it("utilise ownerId si proprietaireId absent (B: proprietaireId arm1)", async () => {
    mockAuthSession("GESTIONNAIRE", S);
    prismaMock.society.findMany.mockResolvedValue([{ id: S } as never]);

    setupCoreMocks();

    await getConsolidatedAnalyticsData(); // pas de proprietaireId
    const societyCall = prismaMock.society.findMany.mock.calls[0][0] as { where?: unknown };
    expect(societyCall?.where).toHaveProperty("ownerId");
    expect(societyCall?.where).not.toHaveProperty("proprietaireId");
  });
});
