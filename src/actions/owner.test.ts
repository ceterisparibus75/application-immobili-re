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
  isOwnerOfSociety,
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


// ── isOwnerOfSociety ──────────────────────────────────────────────

describe("isOwnerOfSociety", () => {
  it("retourne true si la société appartient à l'user (ligne 401)", async () => {
    prismaMock.society.findFirst.mockResolvedValue({ id: "soc-1" } as never);
    const r = await isOwnerOfSociety("user-1", "soc-1");
    expect(r).toBe(true);
  });

  it("retourne false si la société n'appartient pas à l'user (ligne 405)", async () => {
    prismaMock.society.findFirst.mockResolvedValue(null);
    const r = await isOwnerOfSociety("user-1", "soc-other");
    expect(r).toBe(false);
  });
});

// ── getClaimableSocieties unauthenticated ─────────────────────────

describe("getClaimableSocieties — non authentifie", () => {
  it("retourne une erreur si non authentifie (ligne 410)", async () => {
    mockUnauthenticated();
    const r = await getClaimableSocieties();
    expect(r).toEqual({ success: false, error: "Non authentifie" });
  });
});

// ── claimSociety — branches manquantes ───────────────────────────

describe("claimSociety — branches manquantes", () => {
  it("retourne une erreur si non authentifie (ligne 431)", async () => {
    mockUnauthenticated();
    const r = await claimSociety("soc-1");
    expect(r).toEqual({ success: false, error: "Non authentifie" });
  });

  it("retourne une erreur si societe introuvable (ligne 449)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.society.findUnique.mockResolvedValue(null);
    const r = await claimSociety("soc-unknown");
    expect(r).toEqual({ success: false, error: "Societe introuvable" });
  });

  it("retourne une erreur si proprietaire introuvable (ligne 458)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.society.findUnique.mockResolvedValue({ ownerId: null, name: "SCI Test" } as never);
    prismaMock.proprietaire.findFirst.mockResolvedValue(null);
    const r = await claimSociety("soc-1", "prop-unknown");
    expect(r).toEqual({ success: false, error: "Propriétaire introuvable" });
  });
});

// ── getOwnerProfile — branches manquantes ────────────────────────

describe("getOwnerProfile — branches manquantes", () => {
  it("retourne une erreur si non authentifie (ligne 506)", async () => {
    mockUnauthenticated();
    const r = await getOwnerProfile();
    expect(r).toEqual({ success: false, error: "Non authentifie" });
  });

  it("retourne une erreur si utilisateur introuvable (ligne 528)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.user.findUnique.mockResolvedValue(null);
    const r = await getOwnerProfile();
    expect(r).toEqual({ success: false, error: "Utilisateur introuvable" });
  });
});

// ── updateOwnerProfile — non authentifie ─────────────────────────

describe("updateOwnerProfile — non authentifie", () => {
  it("retourne une erreur si non authentifie (ligne 792)", async () => {
    mockUnauthenticated();
    const r = await updateOwnerProfile({ firstName: "Alice", lastName: "Durand" });
    expect(r).toEqual({ success: false, error: "Non authentifie" });
  });
});

// ── getConsolidatedBuildings — branches manquantes ───────────────

describe("getConsolidatedBuildings — branches manquantes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calcule le cout additionnel via additionalAcquisitions (ligne 646)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "b-1", name: "Imm Test", city: "Paris", buildingType: "BUREAU",
        totalArea: 200,
        acquisitionPrice: 100000, acquisitionFees: 0, acquisitionTaxes: 0,
        acquisitionOtherCosts: 0, worksCost: 0,
        additionalAcquisitions: [
          { acquisitionPrice: 20000, acquisitionFees: 1000, acquisitionTaxes: 500, otherCosts: 200 },
        ],
        lots: [],
        propertyValuations: [],
        society: { id: "soc-1", name: "SCI" },
      },
    ] as never);

    const r = await getConsolidatedBuildings();
    expect(r.success).toBe(true);
    expect(r.data![0].totalCost).toBe(121700); // 100000 + 20000+1000+500+200
  });

  it("calcule totalArea depuis les lots si totalArea est null (ligne 650)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockResolvedValue([{ id: "soc-1" }] as never);
    prismaMock.building.findMany.mockResolvedValue([
      {
        id: "b-2", name: "Imm 2", city: "Lyon", buildingType: "COLLECTIF",
        totalArea: null,
        acquisitionPrice: 0, acquisitionFees: 0, acquisitionTaxes: 0,
        acquisitionOtherCosts: 0, worksCost: 0,
        additionalAcquisitions: [],
        lots: [
          { status: "VACANT", area: 30, leases: [] },
          { status: "VACANT", area: 20, leases: [] },
        ],
        propertyValuations: [],
        society: { id: "soc-1", name: "SCI" },
      },
    ] as never);

    const r = await getConsolidatedBuildings();
    expect(r.success).toBe(true);
    expect(r.data![0].totalArea).toBe(50); // 30 + 20
  });

  it("retourne une erreur generique si la BDD echoue (lignes 672-673)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockRejectedValue(new Error("DB error"));
    const r = await getConsolidatedBuildings();
    expect(r.success).toBe(false);
  });
});

// ── getConsolidatedLeases — erreur BDD ───────────────────────────

describe("getConsolidatedLeases — erreur BDD", () => {
  it("retourne une erreur generique si la BDD echoue (lignes 731-732)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockRejectedValue(new Error("DB error"));
    const r = await getConsolidatedLeases();
    expect(r.success).toBe(false);
  });
});

// ── getConsolidatedLoans — erreur BDD ────────────────────────────

describe("getConsolidatedLoans — erreur BDD", () => {
  it("retourne une erreur generique si la BDD echoue (lignes 785-786)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockRejectedValue(new Error("DB error"));
    const r = await getConsolidatedLoans();
    expect(r.success).toBe(false);
  });
});

// ── getOwnerAnalytics — branches manquantes ───────────────────────

describe("getOwnerAnalytics — branches manquantes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne une erreur generique si la BDD echoue (lignes 395-396)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.society.findMany.mockRejectedValue(new Error("DB error"));
    const r = await getOwnerAnalytics();
    expect(r.success).toBe(false);
  });

  it("calcule les seaux d'impayes et les baux expirants (lignes 246,264,287-292,303,360)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    const now = new Date();
    const past35Days = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const past65Days = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000);
    const past95Days = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000);
    const past25Days = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    prismaMock.society.findMany.mockResolvedValue([
      { id: "soc-1", name: "SCI Test", legalForm: "SCI", city: "Lyon", logoUrl: null },
    ] as never);

    prismaMock.building.findMany.mockResolvedValue([
      {
        societyId: "soc-1",
        acquisitionPrice: 100000, acquisitionFees: 0, acquisitionTaxes: 0,
        acquisitionOtherCosts: 0, worksCost: 0,
        additionalAcquisitions: [
          { acquisitionPrice: 10000, acquisitionFees: 0, acquisitionTaxes: 0, otherCosts: 0 },
        ],
      },
    ] as never);
    prismaMock.lot.findMany.mockResolvedValue([
      { status: "OCCUPE", building: { societyId: "soc-1" } },
    ] as never);
    type GroupByMock = { mockResolvedValueOnce: (v: unknown) => GroupByMock };
    (prismaMock.lease.groupBy as unknown as GroupByMock)
      .mockResolvedValueOnce([{ societyId: "soc-1", _count: { id: 1 } }] as never)
      .mockResolvedValueOnce([{ societyId: "soc-1", _sum: { currentRentHT: 800 } }] as never);
    (prismaMock.invoice.groupBy as unknown as GroupByMock)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ societyId: "soc-1", _sum: { totalTTC: 500 } }] as never);
    prismaMock.bankAccount.findMany.mockResolvedValue([] as never);
    prismaMock.loan.findMany
      .mockResolvedValueOnce([
        { societyId: "soc-1", lender: "BNP", amount: 100000, purchaseValue: null, amortizationLines: [{ remainingBalance: 80000, totalPayment: 600 }] },
        { societyId: "soc-1", lender: "CA", amount: 50000, purchaseValue: null, amortizationLines: [{ remainingBalance: 40000, totalPayment: 400 }] },
      ] as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      { dueDate: past25Days, totalTTC: 100 },   // < 30 days
      { dueDate: past35Days, totalTTC: 200 },   // 30-60 days
      { dueDate: past65Days, totalTTC: 300 },   // 60-90 days
      { dueDate: past95Days, totalTTC: 400 },   // > 90 days
    ] as never);
    prismaMock.lease.findMany.mockResolvedValue([
      {
        id: "lease-exp-1",
        endDate: in30Days,
        societyId: "soc-1",
        tenant: { firstName: "Jean", lastName: "Dupont", companyName: null, entityType: "PERSONNE_PHYSIQUE" },
        lot: { number: "3A", building: { name: "Les Lilas" } },
      },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);

    const r = await getOwnerAnalytics();
    expect(r.success).toBe(true);
    expect(r.data?.totalPatrimonyValue).toBe(110000); // 100000+10000
    expect(r.data?.overdueByAge[0].amount).toBe(100);  // < 30j
    expect(r.data?.overdueByAge[1].amount).toBe(200);  // 30-60j
    expect(r.data?.overdueByAge[2].amount).toBe(300);  // 60-90j
    expect(r.data?.overdueByAge[3].amount).toBe(400);  // > 90j
    expect(r.data?.expiringLeases).toHaveLength(1);
    expect(r.data?.expiringLeases[0].tenantName).toBe("Jean Dupont");
    expect(r.data?.lenderSummaries).toHaveLength(2);
    // Sort by remainingBalance desc: BNP 80000 > CA 40000
    expect(r.data?.lenderSummaries[0].lender).toBe("BNP");
  });
});

