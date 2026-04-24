import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/management-report-ai", () => ({ analyzeManagementReport: vi.fn() }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import {
  getManagementReports,
  getManagementReportById,
  createManualReport,
  deleteManagementReport,
} from "./management-report";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const LEASE_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const REPORT_ID = "clh3x2z4k0002qh8g7z1y2v3v";

const validInput = {
  leaseId: LEASE_ID,
  periodStart: "2025-01-01",
  periodEnd: "2025-01-31",
  grossRent: 1200,
  feeAmountHT: 120,
  feeAmountTTC: 144,
  netTransfer: 1056,
};

function makeReport(overrides = {}) {
  return {
    id: REPORT_ID,
    societyId: SOCIETY_ID,
    leaseId: LEASE_ID,
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-01-31"),
    grossRent: 1200,
    chargesAmount: null,
    feeAmountHT: 120,
    feeAmountTTC: 144,
    netTransfer: 1056,
    isReconciled: false,
    aiAnalyzed: false,
    notes: null,
    ...overrides,
  };
}

function makeLease(overrides = {}) {
  return {
    id: LEASE_ID,
    societyId: SOCIETY_ID,
    isThirdPartyManaged: true,
    ...overrides,
  };
}

describe("getManagementReports", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getManagementReports(SOCIETY_ID);
    expect(result.success).toBe(false);
  });

  it("retourne les relevés de gestion de la société", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findMany.mockResolvedValue([makeReport()] as never);

    const result = await getManagementReports(SOCIETY_ID);
    expect(result.success).toBe(true);
    expect((result.data as { reports: unknown[] }).reports).toHaveLength(1);
  });

  it("filtre par leaseId si fourni", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findMany.mockResolvedValue([] as never);

    await getManagementReports(SOCIETY_ID, LEASE_ID);

    expect(prismaMock.managementReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ leaseId: LEASE_ID }) })
    );
  });
});

describe("getManagementReportById", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getManagementReportById(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si relevé introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findFirst.mockResolvedValue(null);

    const result = await getManagementReportById(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne le relevé si trouvé", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findFirst.mockResolvedValue(makeReport() as never);

    const result = await getManagementReportById(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(true);
    expect((result.data as { report: { id: string } }).report.id).toBe(REPORT_ID);
  });
});

describe("createManualReport", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createManualReport(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si validation Zod échoue", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    const result = await createManualReport(SOCIETY_ID, { ...validInput, grossRent: -1 });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si bail introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await createManualReport(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("retourne une erreur si bail non en gestion tiers", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(makeLease({ isThirdPartyManaged: false }) as never);

    const result = await createManualReport(SOCIETY_ID, validInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/gestion tiers/);
  });

  it("crée le relevé manuellement avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.lease.findFirst.mockResolvedValue(makeLease() as never);
    prismaMock.managementReport.create.mockResolvedValue(makeReport() as never);

    const result = await createManualReport(SOCIETY_ID, validInput);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(REPORT_ID);
    expect(prismaMock.managementReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grossRent: 1200, netTransfer: 1056, aiAnalyzed: false }),
      })
    );
  });
});

describe("deleteManagementReport", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteManagementReport(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si relevé introuvable", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findFirst.mockResolvedValue(null);

    const result = await deleteManagementReport(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/introuvable/);
  });

  it("refuse la suppression si déjà rapproché", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findFirst.mockResolvedValue(makeReport({ isReconciled: true }) as never);

    const result = await deleteManagementReport(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rapproche/);
  });

  it("supprime le relevé avec succès", async () => {
    mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
    prismaMock.managementReport.findFirst.mockResolvedValue(makeReport() as never);
    prismaMock.managementReport.delete.mockResolvedValue(makeReport() as never);

    const result = await deleteManagementReport(SOCIETY_ID, REPORT_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.managementReport.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: REPORT_ID } })
    );
  });
});
