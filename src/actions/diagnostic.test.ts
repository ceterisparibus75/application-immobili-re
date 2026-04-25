import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createDiagnostic,
  deleteDiagnostic,
  updateDiagnostic,
} from "./diagnostic";

const SOCIETY_ID = "society-1";
const BUILDING_ID = "cm8m6m6m6000008l2a1bcdefg";
const DIAGNOSTIC_ID = "cm8m6m6m6000008l2a1bcdefh";

describe("diagnostic actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();

    const result = await createDiagnostic(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      type: "DPE",
      performedAt: "2026-04-20",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne une erreur de validation si l'URL du fichier est invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);

    const result = await createDiagnostic(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      type: "DPE",
      performedAt: "2026-04-20",
      fileUrl: "not-an-url",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("URL invalide");
  });

  it("crée un diagnostic avec analyse IA et audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.diagnostic.create.mockResolvedValue({
      id: DIAGNOSTIC_ID,
      type: "DPE",
      buildingId: BUILDING_ID,
    } as never);

    const result = await createDiagnostic(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      type: "DPE",
      performedAt: "2026-04-20",
      expiresAt: "2036-04-20",
      aiAnalysis: "Classe énergétique C",
    });

    expect(result).toEqual({ success: true, data: { id: DIAGNOSTIC_ID } });
    expect(prismaMock.diagnostic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buildingId: BUILDING_ID,
        type: "DPE",
        performedAt: new Date("2026-04-20"),
        expiresAt: new Date("2036-04-20"),
        aiAnalysis: "Classe énergétique C",
        aiAnalyzedAt: expect.any(Date),
      }),
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Diagnostic",
        entityId: DIAGNOSTIC_ID,
      })
    );
  });

  it("met à jour puis supprime un diagnostic existant", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.diagnostic.findFirst
      .mockResolvedValueOnce({ id: DIAGNOSTIC_ID, buildingId: BUILDING_ID } as never)
      .mockResolvedValueOnce({ id: DIAGNOSTIC_ID, buildingId: BUILDING_ID } as never);

    const updateResult = await updateDiagnostic(SOCIETY_ID, {
      id: DIAGNOSTIC_ID,
      result: "Conforme",
      expiresAt: "2030-01-01",
    });
    const deleteResult = await deleteDiagnostic(SOCIETY_ID, DIAGNOSTIC_ID);

    expect(updateResult).toEqual({ success: true });
    expect(prismaMock.diagnostic.update).toHaveBeenCalledWith({
      where: { id: DIAGNOSTIC_ID },
      data: {
        result: "Conforme",
        expiresAt: new Date("2030-01-01"),
        performedAt: undefined,
      },
    });
    expect(deleteResult).toEqual({ success: true });
    expect(prismaMock.diagnostic.delete).toHaveBeenCalledWith({
      where: { id: DIAGNOSTIC_ID },
    });
  });

  it("retourne une erreur si l'immeuble n'existe pas lors de createDiagnostic", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue(null);

    const result = await createDiagnostic(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      type: "DPE",
      performedAt: "2026-04-20",
    });

    expect(result).toEqual({ success: false, error: "Immeuble introuvable" });
  });

  it("retourne une erreur si updateDiagnostic ne trouve pas le diagnostic", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.diagnostic.findFirst.mockResolvedValue(null);

    const result = await updateDiagnostic(SOCIETY_ID, {
      id: DIAGNOSTIC_ID,
      result: "Conforme",
    });

    expect(result).toEqual({ success: false, error: "Diagnostic introuvable" });
  });

  it("retourne une erreur si deleteDiagnostic ne trouve pas le diagnostic", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.diagnostic.findFirst.mockResolvedValue(null);

    const result = await deleteDiagnostic(SOCIETY_ID, DIAGNOSTIC_ID);

    expect(result).toEqual({ success: false, error: "Diagnostic introuvable" });
  });

  it("retourne non authentifié pour updateDiagnostic", async () => {
    mockUnauthenticated();
    const result = await updateDiagnostic(SOCIETY_ID, { id: DIAGNOSTIC_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne non authentifié pour deleteDiagnostic", async () => {
    mockUnauthenticated();
    const result = await deleteDiagnostic(SOCIETY_ID, DIAGNOSTIC_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });
});
