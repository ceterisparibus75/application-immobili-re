import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const revalidatePath = vi.hoisted(() => vi.fn());

type GroupByMock = {
  mockResolvedValueOnce: (value: unknown) => GroupByMock;
};

vi.mock("next/cache", () => ({ revalidatePath }));

import {
  claimSociety,
  getClaimableSocieties,
  getOwnerProfile,
  getOwnerSocieties,
  updateOwnerProfile,
  getConsolidatedBuildings,
  getConsolidatedLeases,
  getConsolidatedLoans,
  getOwnerAnalytics,
} from "./owner";

describe("owner actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur silencieuse non authentifiée pour les sociétés du propriétaire", async () => {
    mockUnauthenticated();

    const result = await getOwnerSocieties();

    expect(result).toEqual({
      success: false,
      error: "Non authentifie",
    });
  });

  it("liste les sociétés rattachées au propriétaire demandé", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.society.findMany.mockResolvedValue([
      {
        id: "society-1",
        name: "SCI Horizon",
        legalForm: "SCI",
        siret: "12345678901234",
        city: "Lyon",
        isActive: true,
        logoUrl: null,
      },
    ] as never);

    const result = await getOwnerSocieties("prop-1");

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "society-1",
          name: "SCI Horizon",
          legalForm: "SCI",
          siret: "12345678901234",
          city: "Lyon",
          isActive: true,
          logoUrl: null,
        },
      ],
    });
    expect(prismaMock.society.findMany).toHaveBeenCalledWith({
      where: { proprietaireId: "prop-1", proprietaire: { userId: "user-1" } },
      select: {
        id: true,
        name: true,
        legalForm: true,
        siret: true,
        city: true,
        isActive: true,
        logoUrl: true,
      },
      orderBy: { name: "asc" },
    });
  });

  it("retourne les sociétés revendicables où l'utilisateur est admin", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        society: {
          id: "society-2",
          name: "SARL Atlas",
          legalForm: "SARL",
          siret: null,
          city: "Marseille",
        },
      },
    ] as never);

    const result = await getClaimableSocieties();

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "society-2",
          name: "SARL Atlas",
          legalForm: "SARL",
          siret: null,
          city: "Marseille",
        },
      ],
    });
    expect(prismaMock.userSociety.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        role: { in: ["ADMIN_SOCIETE", "SUPER_ADMIN"] },
        society: { ownerId: null },
      },
      select: {
        society: {
          select: { id: true, name: true, legalForm: true, siret: true, city: true },
        },
      },
    });
  });

  it("refuse de rattacher une société si l'utilisateur n'est pas administrateur", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "GESTIONNAIRE" } as never);

    const result = await claimSociety("society-3");

    expect(result).toEqual({
      success: false,
      error: "Vous devez etre administrateur de cette societe pour la rattacher",
    });
    expect(prismaMock.society.update).not.toHaveBeenCalled();
  });

  it("refuse de rattacher une société qui a déjà un propriétaire", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      ownerId: "user-existing",
      name: "SCI Déjà prise",
    } as never);

    const result = await claimSociety("society-4");

    expect(result).toEqual({
      success: false,
      error: "Cette societe a deja un proprietaire",
    });
  });

  it("rattache une société libre au propriétaire demandé", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      ownerId: null,
      name: "SCI Libre",
    } as never);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-9" } as never);

    const result = await claimSociety("society-5", "prop-9");

    expect(result).toEqual({ success: true });
    expect(prismaMock.society.update).toHaveBeenCalledWith({
      where: { id: "society-5" },
      data: {
        ownerId: "user-1",
        proprietaireId: "prop-9",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/proprietaire");
  });

  it("retourne le profil propriétaire courant", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.user.findUnique.mockResolvedValue({
      email: "owner@example.com",
      firstName: "Alice",
      lastName: "Durand",
      phone: "0102030405",
      birthDate: null,
      birthPlace: null,
      address: "1 rue de Lille",
      postalCode: "59000",
      ownerCity: "Lille",
      profession: "Architecte",
      nationality: "Française",
      company: "AD Conseil",
      emailCopyEnabled: true,
      emailCopyAddress: "copie@example.com",
    } as never);

    const result = await getOwnerProfile();

    expect(result).toEqual({
      success: true,
      data: {
        email: "owner@example.com",
        firstName: "Alice",
        lastName: "Durand",
        phone: "0102030405",
        birthDate: null,
        birthPlace: null,
        address: "1 rue de Lille",
        postalCode: "59000",
        ownerCity: "Lille",
        profession: "Architecte",
        nationality: "Française",
        company: "AD Conseil",
        emailCopyEnabled: true,
        emailCopyAddress: "copie@example.com",
      },
    });
  });

  it("valide prénom et nom avant mise à jour du profil", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);

    const result = await updateOwnerProfile({
      firstName: " ",
      lastName: "Durand",
    });

    expect(result).toEqual({
      success: false,
      error: "Le prenom et le nom sont obligatoires",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("met à jour le profil propriétaire avec des valeurs nettoyées", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);

    const result = await updateOwnerProfile({
      firstName: " Alice ",
      lastName: " Durand ",
      phone: " 0102030405 ",
      birthDate: "2020-01-15",
      birthPlace: " Lille ",
      address: " 1 rue de Lille ",
      postalCode: " 59000 ",
      ownerCity: " Lille ",
      profession: " Architecte ",
      nationality: " Française ",
      company: " AD Conseil ",
      emailCopyEnabled: true,
      emailCopyAddress: " copie@example.com ",
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        firstName: "Alice",
        lastName: "Durand",
        name: "Alice Durand",
        phone: "0102030405",
        birthDate: new Date("2020-01-15"),
        birthPlace: "Lille",
        address: "1 rue de Lille",
        postalCode: "59000",
        ownerCity: "Lille",
        profession: "Architecte",
        nationality: "Française",
        company: "AD Conseil",
        emailCopyEnabled: true,
        emailCopyAddress: "copie@example.com",
      },
    });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, "/proprietaire");
    expect(revalidatePath).toHaveBeenNthCalledWith(2, "/", "layout");
  });
});

// ── getConsolidatedBuildings ──────────────────────────────────────

describe("getConsolidatedBuildings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getConsolidatedBuildings();
    expect(r.success).toBe(false);
  });

  it("retourne [] si l'utilisateur n'a aucune société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    const r = await getConsolidatedBuildings();
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  it("retourne les immeubles consolidés avec calculs de rendement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "b-1", name: "Résidence Les Pins", city: "Nice", buildingType: "COLLECTIF",
        totalArea: 500,
        acquisitionPrice: 200000, acquisitionFees: 10000, acquisitionTaxes: 5000,
        acquisitionOtherCosts: 2000, worksCost: 3000,
        additionalAcquisitions: [],
        lots: [
          { status: "OCCUPE", area: 50, leases: [{ currentRentHT: 700, paymentFrequency: "MENSUEL" }] },
          { status: "VACANT", area: 50, leases: [] },
        ],
        propertyValuations: [{ estimatedValueMid: 250000 }],
        society: { id: "soc-1", name: "SCI Les Pins" },
      },
    ] as never);

    const r = await getConsolidatedBuildings();
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].name).toBe("Résidence Les Pins");
    expect(r.data![0].totalLots).toBe(2);
    expect(r.data![0].occupiedLots).toBe(1);
    expect(r.data![0].annualRent).toBe(8400); // 700 * 12
    expect(r.data![0].totalCost).toBe(220000); // 200000+10000+5000+2000+3000
    expect(r.data![0].venalValue).toBe(250000);
    expect(r.data![0].societyName).toBe("SCI Les Pins");
  });
});

// ── getConsolidatedLeases ─────────────────────────────────────────

describe("getConsolidatedLeases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getConsolidatedLeases();
    expect(r.success).toBe(false);
  });

  it("retourne [] si aucune société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    const r = await getConsolidatedLeases();
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  it("retourne les baux avec le nom du locataire physique calculé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-1", status: "EN_COURS", leaseType: "HABITATION", destination: null,
        startDate: new Date("2024-01-01"), endDate: null,
        currentRentHT: 750, paymentFrequency: "MENSUEL", indexType: "IRL",
        tenant: { entityType: "PERSONNE_PHYSIQUE", companyName: null, firstName: "Jean", lastName: "Dupont" },
        lot: { number: "3A", building: { name: "Les Lilas", postalCode: "75010", city: "Paris" } },
        rentRevisions: [],
        society: { id: "soc-1", name: "SCI Paris" },
      },
    ] as never);

    const r = await getConsolidatedLeases();
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].tenantName).toBe("Jean Dupont");
    expect(r.data![0].lotLabel).toBe("Lot 3A");
    expect(r.data![0].currentRentHT).toBe(750);
    expect(r.data![0].lastRevisionDate).toBeNull();
  });

  it("utilise companyName pour un locataire personne morale", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-2", status: "EN_COURS", leaseType: "COMMERCIAL", destination: "Commerce",
        startDate: new Date("2023-06-01"), endDate: null,
        currentRentHT: 2000, paymentFrequency: "MENSUEL", indexType: "ILC",
        tenant: { entityType: "PERSONNE_MORALE", companyName: "ACME SARL", firstName: null, lastName: null },
        lot: { number: "1", building: { name: "Centre Commercial", postalCode: "69001", city: "Lyon" } },
        rentRevisions: [{ effectiveDate: new Date("2024-06-01") }],
        society: { id: "soc-1", name: "SCI Lyon" },
      },
    ] as never);

    const r = await getConsolidatedLeases();
    expect(r.success).toBe(true);
    expect(r.data![0].tenantName).toBe("ACME SARL");
    expect(r.data![0].lastRevisionDate).toEqual(new Date("2024-06-01"));
  });
});

// ── getConsolidatedLoans ──────────────────────────────────────────

describe("getConsolidatedLoans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getConsolidatedLoans();
    expect(r.success).toBe(false);
  });

  it("retourne [] si aucune société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    const r = await getConsolidatedLoans();
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  it("retourne les emprunts avec le solde restant issu de la dernière ligne d'amortissement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.loan.findMany.mockResolvedValue([
      {
        id: "loan-1", label: "Prêt BNP", lender: "BNP Paribas", loanType: "AMORTISSABLE",
        status: "EN_COURS", amount: 150000, interestRate: 2.5, insuranceRate: 0.3,
        durationMonths: 240, startDate: new Date("2020-01-01"), endDate: new Date("2040-01-01"),
        amortizationLines: [{ remainingBalance: 120000, period: 48, totalPayment: 750 }],
        building: { name: "Les Pins", city: "Nice" },
        society: { id: "soc-1", name: "SCI Nice" },
      },
    ] as never);

    const r = await getConsolidatedLoans();
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(1);
    expect(r.data![0].label).toBe("Prêt BNP");
    expect(r.data![0].remainingBalance).toBe(120000);
    expect(r.data![0].currentPeriod).toBe(48);
    expect(r.data![0].monthlyPayment).toBe(750);
    expect(r.data![0].buildingName).toBe("Les Pins");
    expect(r.data![0].societyName).toBe("SCI Nice");
  });

  it("utilise le montant initial si aucune ligne d'amortissement", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.loan.findMany.mockResolvedValue([
      {
        id: "loan-2", label: "Prêt CA", lender: null, loanType: "IN_FINE",
        status: "EN_COURS", amount: 80000, interestRate: 3.0, insuranceRate: 0.2,
        durationMonths: 120, startDate: new Date("2023-01-01"), endDate: new Date("2033-01-01"),
        amortizationLines: [],
        building: null,
        society: { id: "soc-1", name: "SCI CA" },
      },
    ] as never);

    const r = await getConsolidatedLoans();
    expect(r.success).toBe(true);
    expect(r.data![0].remainingBalance).toBe(80000); // fallback au montant initial
    expect(r.data![0].currentPeriod).toBe(0);
    expect(r.data![0].lender).toBe("Autre"); // lender null → "Autre"
    expect(r.data![0].buildingName).toBeNull();
  });
});

// ── getOwnerAnalytics ─────────────────────────────────────────────

describe("getOwnerAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getOwnerAnalytics();
    expect(r.success).toBe(false);
  });

  it("retourne des zéros si l'utilisateur n'a aucune société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([] as never);
    const r = await getOwnerAnalytics();
    expect(r.success).toBe(true);
    expect(r.data?.totalSocieties).toBe(0);
    expect(r.data?.totalBuildings).toBe(0);
    expect(r.data?.totalLots).toBe(0);
    expect(r.data?.grossYield).toBeNull();
  });

  it("calcule les agrégats consolidés avec une société et des données", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);

    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-1", name: "SCI Test", legalForm: "SCI", city: "Lyon", logoUrl: null },
    ] as never);

    // Promise.all order: building, lot, lease.groupBy(activeLeases), invoice.groupBy(monthRev),
    //   invoice.groupBy(overdue), bankAccount, loan, invoice.findMany(allOverdue),
    //   lease.findMany(expiring), lease.groupBy(rent), charge.findMany
    prismaMock.building.findMany.mockResolvedValue([
      {
        societyId: "soc-1",
        acquisitionPrice: 200000, acquisitionFees: 10000, acquisitionTaxes: 5000,
        acquisitionOtherCosts: 0, worksCost: 5000,
        additionalAcquisitions: [],
      },
    ] as never);
    prismaMock.lot.findMany.mockResolvedValue([
      { status: "OCCUPE", building: { societyId: "soc-1" } },
      { status: "VACANT", building: { societyId: "soc-1" } },
    ] as never);
    (prismaMock.lease.groupBy as unknown as GroupByMock)
      .mockResolvedValueOnce([{ societyId: "soc-1", _count: { id: 1 } }] as never)  // activeLeases
      .mockResolvedValueOnce([{ societyId: "soc-1", _sum: { currentRentHT: 800 } }] as never); // rentAgg
    (prismaMock.invoice.groupBy as unknown as GroupByMock)
      .mockResolvedValueOnce([{ societyId: "soc-1", _sum: { totalTTC: 900 } }] as never)  // monthRevAgg
      .mockResolvedValueOnce([] as never); // overdueInvoices
    prismaMock.bankAccount.findMany.mockResolvedValue([
      { societyId: "soc-1", currentBalance: 5000 },
    ] as never);
    prismaMock.loan.findMany.mockResolvedValue([
      {
        societyId: "soc-1", lender: "BNP", amount: 150000, purchaseValue: null,
        amortizationLines: [{ remainingBalance: 120000, totalPayment: 700 }],
      },
    ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([] as never); // allOverdue
    prismaMock.lease.findMany.mockResolvedValue([] as never);   // expiringLeasesRaw
    prismaMock.charge.findMany.mockResolvedValue([
      { amount: 500 },
    ] as never);

    const r = await getOwnerAnalytics();

    expect(r.success).toBe(true);
    expect(r.data?.totalSocieties).toBe(1);
    expect(r.data?.totalBuildings).toBe(1);
    expect(r.data?.totalLots).toBe(2);
    expect(r.data?.totalOccupied).toBe(1);
    expect(r.data?.occupancyRate).toBe(50);
    expect(r.data?.totalMonthRevenue).toBe(900);
    expect(r.data?.totalActiveLeases).toBe(1);
    expect(r.data?.totalCash).toBe(5000);
    expect(r.data?.totalDebt).toBe(120000);
    expect(r.data?.totalMonthlyLoanPayment).toBe(700);
    expect(r.data?.totalMonthlyRentHT).toBe(800);
    expect(r.data?.totalRecoverableCharges).toBe(500);
    expect(r.data?.totalPatrimonyValue).toBe(220000); // 200000+10000+5000+0+5000
    expect(r.data?.grossYield).toBeGreaterThan(0);
    expect(r.data?.consolidatedLTV).toBeGreaterThan(0);
    expect(r.data?.lenderSummaries).toHaveLength(1);
    expect(r.data?.lenderSummaries[0].lender).toBe("BNP");
    expect(r.data?.overdueByAge).toHaveLength(4);
    expect(r.data?.expiringLeases).toEqual([]);
  });
});
