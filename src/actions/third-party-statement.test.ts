import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createStatement,
  deleteStatement,
  getStatementById,
  getThirdPartyManagedLeases,
  markStatementConforme,
  recordStatementPayment,
  validateStatement,
} from "./third-party-statement";

const SOCIETY_ID = "society-1";
const BUILDING_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const STATEMENT_ID = "clh3x2z4k0002qh8g7z1y2v3v";
const CATEGORY_ID = "clh3x2z4k0003qh8g7z1y2v3w";

describe("third-party-statement actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si la lecture des baux gérés par un tiers est non authentifiée", async () => {
    mockUnauthenticated();

    const result = await getThirdPartyManagedLeases(SOCIETY_ID);

    expect(result).toEqual({
      success: false,
      error: "Non authentifié",
    });
  });

  it("refuse la création d'un relevé syndic si l'immeuble est introuvable", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue(null);

    const result = await createStatement(SOCIETY_ID, {
      type: "APPEL_FONDS",
      buildingId: BUILDING_ID,
      thirdPartyName: "Syndic Alpha",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      receivedDate: "2026-02-01",
      totalAmount: 1200,
      lines: [
        {
          lineType: "CHARGE",
          label: "Appel trimestriel",
          amount: 1200,
          categoryId: CATEGORY_ID,
        },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: "Immeuble introuvable",
    });
  });

  it("crée un relevé, ses lignes et ses charges liées", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock as never)
    );
    prismaMock.thirdPartyStatement.create.mockResolvedValue({
      id: STATEMENT_ID,
    } as never);

    const result = await createStatement(SOCIETY_ID, {
      type: "APPEL_FONDS",
      buildingId: BUILDING_ID,
      thirdPartyName: "Syndic Alpha",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      receivedDate: "2026-02-01",
      totalAmount: 1200,
      lines: [
        {
          lineType: "CHARGE",
          label: "Appel trimestriel",
          amount: 1200,
          categoryId: CATEGORY_ID,
        },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: { id: STATEMENT_ID },
    });
    expect(prismaMock.thirdPartyStatement.create).toHaveBeenCalledWith({
      data: {
        societyId: SOCIETY_ID,
        buildingId: BUILDING_ID,
        leaseId: null,
        type: "APPEL_FONDS",
        thirdPartyName: "Syndic Alpha",
        contactId: null,
        reference: null,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        periodLabel: null,
        receivedDate: new Date("2026-02-01"),
        dueDate: null,
        totalAmount: 1200,
        netAmount: null,
        notes: null,
        lines: {
          create: [
            {
              lineType: "CHARGE",
              label: "Appel trimestriel",
              amount: 1200,
              categoryId: CATEGORY_ID,
              nature: null,
              recoverableRate: null,
              leaseId: null,
            },
          ],
        },
      },
    });
    expect(prismaMock.charge.create).toHaveBeenCalledWith({
      data: {
        societyId: SOCIETY_ID,
        buildingId: BUILDING_ID,
        categoryId: CATEGORY_ID,
        description: "Appel trimestriel",
        amount: 1200,
        date: new Date("2026-02-01"),
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        supplierName: "Syndic Alpha",
        statementId: STATEMENT_ID,
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: SOCIETY_ID,
      userId: "user-1",
      action: "CREATE",
      entity: "ThirdPartyStatement",
      entityId: STATEMENT_ID,
      details: {
        type: "APPEL_FONDS",
        thirdPartyName: "Syndic Alpha",
        totalAmount: 1200,
        linesCount: 1,
        leasesCount: 0,
      },
    });
  });

  it("retourne une erreur si le relevé demandé est introuvable", async () => {
    mockAuthSession(UserRole.COMPTABLE, SOCIETY_ID);
    prismaMock.thirdPartyStatement.findFirst.mockResolvedValue(null);

    const result = await getStatementById(SOCIETY_ID, STATEMENT_ID);

    expect(result).toEqual({
      success: false,
      error: "Relevé introuvable",
    });
  });

  it("valide un brouillon de relevé", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.thirdPartyStatement.findFirst.mockResolvedValue({
      id: STATEMENT_ID,
      status: "BROUILLON",
    } as never);

    const result = await validateStatement(SOCIETY_ID, STATEMENT_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.thirdPartyStatement.update).toHaveBeenCalledWith({
      where: { id: STATEMENT_ID },
      data: { status: "VALIDE" },
    });
  });

  it("enregistre un paiement total d'appel de fonds et marque les charges comme payées", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.thirdPartyStatement.findFirst.mockResolvedValue({
      id: STATEMENT_ID,
      type: "APPEL_FONDS",
      paidAmount: 200,
      totalAmount: 500,
    } as never);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock as never)
    );

    const result = await recordStatementPayment(SOCIETY_ID, {
      statementId: STATEMENT_ID,
      amount: 300,
      paidAt: "2026-02-15",
      method: "virement",
      reference: "VIR-123",
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.thirdPartyStatement.update).toHaveBeenCalledWith({
      where: { id: STATEMENT_ID },
      data: {
        paidAmount: 500,
        paidAt: new Date("2026-02-15"),
        paymentMethod: "virement",
        paymentReference: "VIR-123",
        status: "PAYE",
      },
    });
    expect(prismaMock.charge.updateMany).toHaveBeenCalledWith({
      where: { statementId: STATEMENT_ID },
      data: { isPaid: true },
    });
  });

  it("marque un relevé vérifié comme conforme", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.thirdPartyStatement.findFirst.mockResolvedValue({
      id: STATEMENT_ID,
      status: "VERIFIE",
    } as never);

    const result = await markStatementConforme(SOCIETY_ID, STATEMENT_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.thirdPartyStatement.update).toHaveBeenCalledWith({
      where: { id: STATEMENT_ID },
      data: { status: "CONFORME" },
    });
  });

  it("supprime un brouillon et ses dépendances", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.thirdPartyStatement.findFirst.mockResolvedValue({
      id: STATEMENT_ID,
      status: "BROUILLON",
      type: "APPEL_FONDS",
      thirdPartyName: "Syndic Alpha",
      totalAmount: 1200,
    } as never);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock as never)
    );

    const result = await deleteStatement(SOCIETY_ID, STATEMENT_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.charge.deleteMany).toHaveBeenCalledWith({
      where: { statementId: STATEMENT_ID },
    });
    expect(prismaMock.thirdPartyStatementLease.deleteMany).toHaveBeenCalledWith({
      where: { statementId: STATEMENT_ID },
    });
    expect(prismaMock.thirdPartyStatementLine.deleteMany).toHaveBeenCalledWith({
      where: { statementId: STATEMENT_ID },
    });
    expect(prismaMock.thirdPartyStatement.delete).toHaveBeenCalledWith({
      where: { id: STATEMENT_ID },
    });
  });
});
