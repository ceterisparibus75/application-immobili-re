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

const { sendChargeStatementEmail } = vi.hoisted(() => ({
  sendChargeStatementEmail: vi.fn().mockResolvedValue({ success: true, emailId: "email-123" }),
}));
vi.mock("@/lib/email", () => ({ sendChargeStatementEmail }));

vi.mock("@/lib/charge-statement-pdf", () => ({
  generateChargeStatementPdfBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf-content")),
}));

import { sendChargeRegularization } from "./charge-statement";
import { createAuditLog } from "@/lib/audit";

const baseRegularization = {
  id: "reg-1",
  societyId: "soc-1",
  fiscalYear: 2024,
  periodStart: new Date("2024-01-01"),
  periodEnd: new Date("2024-12-31"),
  totalCharges: 1200,
  totalProvisions: 1000,
  balance: 200,
  isFinalized: true,
  statementFileUrl: null,
  details: {
    tenantName: "Jean Dupont",
    lotNumber: "A1",
    buildingId: "building-1",
    prorataDays: 365,
    categories: [
      {
        categoryName: "Eau",
        nature: "RECUPERABLE",
        totalAmount: 1200,
        recoverableAmount: 1200,
        allocationMethod: "TANTIEME",
        allocationRate: 50,
        tenantShare: 600,
      },
    ],
    totalRecoverableAllocated: 600,
  },
  lease: {
    id: "lease-1",
    tenant: {
      id: "tenant-1",
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean.dupont@example.com",
      entityType: "PERSONNE_PHYSIQUE",
      companyName: null,
    },
    lot: {
      number: "A1",
      building: { id: "building-1", name: "Residence Belle Vue", city: "Paris" },
    },
  },
};

const baseSociety = {
  name: "SCI Test",
  addressLine1: "1 rue Test",
  postalCode: "75001",
  city: "Paris",
  email: "contact@scitest.fr",
  logoUrl: null,
  siret: null,
  phone: null,
};

describe("sendChargeRegularization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSocietyActionContext.mockResolvedValue({ userId: "user-1" });
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(baseRegularization as never);
    prismaMock.society.findUnique.mockResolvedValue(baseSociety as never);
  });

  it("retourne une erreur si l'auth echoue", async () => {
    requireSocietyActionContext.mockRejectedValue(new Error("Acces refuse"));
    const result = await sendChargeRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si la regularisation est introuvable", async () => {
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(null);
    const result = await sendChargeRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("retourne une erreur si le locataire n'a pas d'email", async () => {
    const noEmail = {
      ...baseRegularization,
      lease: {
        ...baseRegularization.lease,
        tenant: { ...baseRegularization.lease.tenant, email: null },
      },
    };
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(noEmail as never);
    const result = await sendChargeRegularization("soc-1", "reg-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("email");
  });

  it("envoie l'email et retourne success avec emailId", async () => {
    const result = await sendChargeRegularization("soc-1", "reg-1");
    expect(result.success).toBe(true);
    expect(result.data?.emailId).toBe("email-123");
    expect(sendChargeStatementEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jean.dupont@example.com",
        tenantName: "Jean Dupont",
        fiscalYear: 2024,
        balance: 200,
      })
    );
  });

  it("cree un audit log avec l'event CHARGE_STATEMENT_SENT", async () => {
    await sendChargeRegularization("soc-1", "reg-1");
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "ChargeRegularization",
        entityId: "reg-1",
        details: expect.objectContaining({ event: "CHARGE_STATEMENT_SENT", fiscalYear: 2024 }),
      })
    );
  });

  it("construit le nom depuis companyName pour PERSONNE_MORALE", async () => {
    const moralReg = {
      id: "reg-2",
      societyId: "soc-1",
      fiscalYear: 2024,
      periodStart: new Date("2024-01-01"),
      periodEnd: new Date("2024-12-31"),
      totalCharges: 800,
      totalProvisions: 900,
      balance: -100,
      isFinalized: true,
      statementFileUrl: null,
      details: null,
      lease: {
        id: "lease-2",
        tenant: {
          id: "tenant-2",
          firstName: null,
          lastName: null,
          email: "sarl@example.com",
          entityType: "PERSONNE_MORALE",
          companyName: "SARL Dupont",
        },
        lot: {
          number: "B2",
          building: { id: "building-1", name: "Immeuble Test", city: "Lyon" },
        },
      },
    };
    prismaMock.chargeRegularization.findFirst.mockResolvedValue(moralReg as never);
    await sendChargeRegularization("soc-1", "reg-2");
    expect(sendChargeStatementEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tenantName: "SARL Dupont" })
    );
  });
});

