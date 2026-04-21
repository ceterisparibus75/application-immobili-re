import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { exportTenantData } from "./rgpd-export";

const SOCIETY_ID = "society-rgpd";
const REQUESTER_EMAIL = "tenant@example.com";

describe("exportTenantData", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("retourne un export structuré et sanitize les données sensibles et techniques", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T10:15:00.000Z"));

    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: "tenant-1",
        createdAt: new Date("2025-01-01T09:00:00.000Z"),
        updatedAt: new Date("2025-02-01T09:00:00.000Z"),
        entityType: "PERSONNE_PHYSIQUE",
        isActive: true,
        companyName: null,
        companyLegalForm: null,
        siret: null,
        siren: null,
        codeAPE: null,
        vatNumber: null,
        companyAddress: null,
        shareCapital: null,
        legalRepName: null,
        legalRepTitle: null,
        legalRepEmail: null,
        legalRepPhone: null,
        lastName: "Durand",
        firstName: "Alice",
        birthDate: new Date("1990-06-15T00:00:00.000Z"),
        birthPlace: "Paris",
        personalAddress: "12 rue de Paris",
        autoEntrepreneurSiret: null,
        email: REQUESTER_EMAIL,
        billingEmail: "factures@example.com",
        phone: "0102030405",
        mobile: "0607080910",
        language: "fr",
        riskIndicator: "LOW",
        notes: "Locataire fiable",
        insuranceExpiresAt: new Date("2026-12-31T00:00:00.000Z"),
        leases: [
          {
            id: "lease-1",
            createdAt: new Date("2025-01-02T10:00:00.000Z"),
            leaseType: "HABITATION",
            status: "EN_COURS",
            startDate: new Date("2025-01-05T00:00:00.000Z"),
            endDate: new Date("2027-01-04T00:00:00.000Z"),
            durationMonths: 24,
            baseRentHT: 1000,
            currentRentHT: 1025,
            depositAmount: 2000,
            paymentFrequency: "MENSUEL",
            billingTerm: "A_ECHOIR",
            vatApplicable: false,
            vatRate: 0,
            indexType: "IRL",
            entryDate: new Date("2025-01-05T00:00:00.000Z"),
            exitDate: null,
            depositReceivedAt: new Date("2025-01-04T00:00:00.000Z"),
            depositReturnedAt: null,
            depositReturnAmount: null,
            lot: {
              id: "lot-1",
              number: "A12",
              lotType: "APPARTEMENT",
              area: 48,
              floor: "2",
              description: "T2 cour intérieure",
            },
          },
        ],
        invoices: [
          {
            id: "invoice-1",
            createdAt: new Date("2025-02-01T10:00:00.000Z"),
            invoiceNumber: "INV-001",
            invoiceType: "APPEL_LOYER",
            status: "PAYEE",
            issueDate: new Date("2025-02-01T00:00:00.000Z"),
            dueDate: new Date("2025-02-05T00:00:00.000Z"),
            periodStart: new Date("2025-02-01T00:00:00.000Z"),
            periodEnd: new Date("2025-02-28T00:00:00.000Z"),
            totalHT: 1000,
            totalVAT: 0,
            totalTTC: 1000,
            sentAt: new Date("2025-02-01T12:00:00.000Z"),
            lines: [
              {
                label: "Loyer février",
                quantity: 1,
                unitPrice: 1000,
                vatRate: 0,
                totalHT: 1000,
                totalVAT: 0,
                totalTTC: 1000,
                internalCode: "TECH-001",
              },
            ],
            payments: [
              {
                id: "payment-1",
                createdAt: new Date("2025-02-03T10:00:00.000Z"),
                amount: 1000,
                paidAt: new Date("2025-02-03T00:00:00.000Z"),
                method: "VIREMENT",
                reference: "VIR-001",
              },
            ],
          },
        ],
        documents: [
          {
            id: "doc-1",
            createdAt: new Date("2025-01-10T10:00:00.000Z"),
            fileName: "piece-identite.pdf",
            fileSize: 12345,
            mimeType: "application/pdf",
            category: "identite",
            description: "Carte d'identité",
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            fileUrl: "https://private.example.com/file.pdf",
            storagePath: "documents/private/file.pdf",
          },
        ],
      },
    ] as never);

    prismaMock.consent.findMany.mockResolvedValue([
      {
        id: "consent-1",
        createdAt: new Date("2025-01-01T08:00:00.000Z"),
        email: REQUESTER_EMAIL,
        purpose: "newsletter",
        isGranted: true,
        revokedAt: null,
      },
    ] as never);

    const result = await exportTenantData(SOCIETY_ID, REQUESTER_EMAIL);

    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: SOCIETY_ID, email: REQUESTER_EMAIL },
      })
    );
    expect(prismaMock.consent.findMany).toHaveBeenCalledWith({
      where: { email: REQUESTER_EMAIL },
    });

    expect(result.exportDate).toBe("2026-04-20T10:15:00.000Z");
    expect(result.societyId).toBe(SOCIETY_ID);
    expect(result.requesterEmail).toBe(REQUESTER_EMAIL);
    expect(result.tenants).toHaveLength(1);

    const exportedTenant = result.tenants[0];

    expect(exportedTenant.tenant).toMatchObject({
      id: "tenant-1",
      firstName: "Alice",
      lastName: "Durand",
      email: REQUESTER_EMAIL,
      birthDate: "1990-06-15T00:00:00.000Z",
      insuranceExpiresAt: "2026-12-31T00:00:00.000Z",
    });
    expect(exportedTenant.tenant).not.toHaveProperty("updatedAt");

    expect(exportedTenant.leases).toEqual([
      expect.objectContaining({
        id: "lease-1",
        startDate: "2025-01-05T00:00:00.000Z",
        lot: expect.objectContaining({
          number: "A12",
          area: 48,
        }),
      }),
    ]);

    expect(exportedTenant.invoices).toEqual([
      expect.objectContaining({
        id: "invoice-1",
        invoiceNumber: "INV-001",
        lines: [
          {
            label: "Loyer février",
            quantity: 1,
            unitPrice: 1000,
            vatRate: 0,
            totalHT: 1000,
            totalVAT: 0,
            totalTTC: 1000,
          },
        ],
      }),
    ]);

    expect(exportedTenant.payments).toEqual([
      expect.objectContaining({
        id: "payment-1",
        amount: 1000,
        paidAt: "2025-02-03T00:00:00.000Z",
      }),
    ]);

    expect(exportedTenant.documents).toEqual([
      {
        id: "doc-1",
        createdAt: "2025-01-10T10:00:00.000Z",
        fileName: "piece-identite.pdf",
        fileSize: 12345,
        mimeType: "application/pdf",
        category: "identite",
        description: "Carte d'identité",
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
    ]);
    expect(exportedTenant.documents[0]).not.toHaveProperty("fileUrl");
    expect(exportedTenant.documents[0]).not.toHaveProperty("storagePath");

    expect(exportedTenant.consents).toEqual([
      {
        id: "consent-1",
        createdAt: "2025-01-01T08:00:00.000Z",
        email: REQUESTER_EMAIL,
        purpose: "newsletter",
        isGranted: true,
        revokedAt: null,
      },
    ]);
  });

  it("agrège les paiements de toutes les factures du locataire", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: "tenant-1",
        createdAt: new Date(),
        entityType: "PERSONNE_PHYSIQUE",
        isActive: true,
        leases: [],
        documents: [],
        invoices: [
          {
            id: "invoice-1",
            createdAt: new Date(),
            invoiceNumber: "INV-001",
            invoiceType: "APPEL_LOYER",
            status: "PAYEE",
            issueDate: new Date(),
            dueDate: new Date(),
            periodStart: null,
            periodEnd: null,
            totalHT: 100,
            totalVAT: 0,
            totalTTC: 100,
            sentAt: null,
            lines: [],
            payments: [
              {
                id: "payment-1",
                createdAt: new Date("2025-03-01T00:00:00.000Z"),
                amount: 100,
                paidAt: new Date("2025-03-02T00:00:00.000Z"),
                method: "VIREMENT",
                reference: "PAY-1",
              },
            ],
          },
          {
            id: "invoice-2",
            createdAt: new Date(),
            invoiceNumber: "INV-002",
            invoiceType: "QUITTANCE",
            status: "PAYEE",
            issueDate: new Date(),
            dueDate: new Date(),
            periodStart: null,
            periodEnd: null,
            totalHT: 200,
            totalVAT: 0,
            totalTTC: 200,
            sentAt: null,
            lines: [],
            payments: [
              {
                id: "payment-2",
                createdAt: new Date("2025-04-01T00:00:00.000Z"),
                amount: 200,
                paidAt: new Date("2025-04-02T00:00:00.000Z"),
                method: "PRELEVEMENT",
                reference: "PAY-2",
              },
            ],
          },
        ],
      },
    ] as never);
    prismaMock.consent.findMany.mockResolvedValue([] as never);

    const result = await exportTenantData(SOCIETY_ID, REQUESTER_EMAIL);

    expect(result.tenants[0].payments).toHaveLength(2);
    expect(result.tenants[0].payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment-1", amount: 100 }),
        expect.objectContaining({ id: "payment-2", amount: 200 }),
      ])
    );
  });

  it("duplique les consentements sur chaque locataire exporté pour le même email", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([
      { id: "tenant-1", createdAt: new Date(), entityType: "PERSONNE_PHYSIQUE", isActive: true, leases: [], invoices: [], documents: [] },
      { id: "tenant-2", createdAt: new Date(), entityType: "PERSONNE_MORALE", isActive: false, leases: [], invoices: [], documents: [] },
    ] as never);
    prismaMock.consent.findMany.mockResolvedValue([
      {
        id: "consent-1",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        email: REQUESTER_EMAIL,
        purpose: "marketing",
        isGranted: false,
        revokedAt: new Date("2025-02-01T00:00:00.000Z"),
      },
    ] as never);

    const result = await exportTenantData(SOCIETY_ID, REQUESTER_EMAIL);

    expect(result.tenants).toHaveLength(2);
    expect(result.tenants[0].consents).toHaveLength(1);
    expect(result.tenants[1].consents).toHaveLength(1);
    expect(result.tenants[0].consents[0]).toEqual(result.tenants[1].consents[0]);
  });

  it("retourne un export vide mais cohérent si aucun locataire ne correspond", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([] as never);
    prismaMock.consent.findMany.mockResolvedValue([
      {
        id: "consent-1",
        createdAt: new Date(),
        email: REQUESTER_EMAIL,
        purpose: "newsletter",
        isGranted: true,
        revokedAt: null,
      },
    ] as never);

    const result = await exportTenantData(SOCIETY_ID, REQUESTER_EMAIL);

    expect(result.societyId).toBe(SOCIETY_ID);
    expect(result.requesterEmail).toBe(REQUESTER_EMAIL);
    expect(result.tenants).toEqual([]);
  });
});
