import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createChargeProvision,
  deleteChargeProvision,
  updateChargeProvision,
} from "./chargeProvision";

const SOCIETY_ID = "society-1";
const LEASE_ID = "cm8m6m6m6000008l2a1bcdefg";
const LOT_ID = "cm8m6m6m6000008l2a1bcdefh";
const PROVISION_ID = "cm8m6m6m6000008l2a1bcdefi";

describe("chargeProvision actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();

    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "Provision sur charges",
      monthlyAmount: 120,
      vatRate: 20,
      startDate: "2026-01-01",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne une erreur de validation si le montant est invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);

    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "",
      monthlyAmount: 0,
      vatRate: 20,
      startDate: "",
    } as never);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Le libellé est requis");
    expect(result.error).toContain("Le montant doit être supérieur à 0");
    expect(result.error).toContain("La date de début est requise");
  });

  it("crée une provision sur bail existant et écrit l'audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.chargeProvision.create.mockResolvedValue({ id: PROVISION_ID } as never);

    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "Taxe foncière",
      monthlyAmount: 85,
      vatRate: 10,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    expect(result).toEqual({ success: true, data: { id: PROVISION_ID } });
    expect(prismaMock.chargeProvision.create).toHaveBeenCalledWith({
      data: {
        leaseId: LEASE_ID,
        lotId: LOT_ID,
        label: "Taxe foncière",
        monthlyAmount: 85,
        vatRate: 10,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isActive: true,
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "ChargeProvision",
        entityId: PROVISION_ID,
      })
    );
  });

  it("met à jour puis supprime une provision existante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.chargeProvision.findFirst
      .mockResolvedValueOnce({
        id: PROVISION_ID,
        lease: { societyId: SOCIETY_ID, id: LEASE_ID },
      } as never)
      .mockResolvedValueOnce({
        id: PROVISION_ID,
        leaseId: LEASE_ID,
        lease: { societyId: SOCIETY_ID, id: LEASE_ID },
      } as never);

    const updateResult = await updateChargeProvision(SOCIETY_ID, {
      id: PROVISION_ID,
      label: "Provision ajustée",
      monthlyAmount: 95,
      vatRate: 5.5,
      startDate: "2026-02-01",
      endDate: null,
      isActive: false,
    });
    const deleteResult = await deleteChargeProvision(SOCIETY_ID, PROVISION_ID);

    expect(updateResult).toEqual({ success: true, data: { id: PROVISION_ID } });
    expect(prismaMock.chargeProvision.update).toHaveBeenCalledWith({
      where: { id: PROVISION_ID },
      data: {
        label: "Provision ajustée",
        monthlyAmount: 95,
        vatRate: 5.5,
        startDate: new Date("2026-02-01"),
        endDate: null,
        isActive: false,
      },
    });
    expect(deleteResult).toEqual({ success: true });
    expect(prismaMock.chargeProvision.delete).toHaveBeenCalledWith({
      where: { id: PROVISION_ID },
    });
  });

  it("retourne Bail introuvable si lease n'appartient pas à la société", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "Provision",
      monthlyAmount: 50,
      vatRate: 0,
      startDate: "2026-01-01",
    });

    expect(result).toEqual({ success: false, error: "Bail introuvable" });
  });

  it("retourne Provision introuvable pour updateChargeProvision si société ne correspond pas", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.chargeProvision.findFirst.mockResolvedValue({
      id: PROVISION_ID,
      lease: { societyId: "autre-societe", id: LEASE_ID },
    } as never);

    const result = await updateChargeProvision(SOCIETY_ID, {
      id: PROVISION_ID,
      label: "Test",
      monthlyAmount: 50,
      vatRate: 0,
      startDate: "2026-01-01",
    });

    expect(result).toEqual({ success: false, error: "Provision introuvable" });
  });

  it("retourne Provision introuvable pour deleteChargeProvision si société ne correspond pas", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.chargeProvision.findFirst.mockResolvedValue({
      id: PROVISION_ID,
      leaseId: LEASE_ID,
      lease: { societyId: "autre-societe", id: LEASE_ID },
    } as never);

    const result = await deleteChargeProvision(SOCIETY_ID, PROVISION_ID);

    expect(result).toEqual({ success: false, error: "Provision introuvable" });
  });

  it("retourne non authentifié pour updateChargeProvision", async () => {
    mockUnauthenticated();
    const result = await updateChargeProvision(SOCIETY_ID, {
      id: PROVISION_ID,
      label: "x",
      monthlyAmount: 1,
      vatRate: 0,
      startDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne non authentifié pour deleteChargeProvision", async () => {
    mockUnauthenticated();
    const result = await deleteChargeProvision(SOCIETY_ID, PROVISION_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne une erreur si rôle insuffisant pour updateChargeProvision", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await updateChargeProvision(SOCIETY_ID, {
      id: PROVISION_ID, label: "x", monthlyAmount: 1, vatRate: 0, startDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateChargeProvision", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.chargeProvision.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await updateChargeProvision(SOCIETY_ID, {
      id: PROVISION_ID, label: "x", monthlyAmount: 1, vatRate: 0, startDate: "2026-01-01",
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });

  it("retourne une erreur si rôle insuffisant pour deleteChargeProvision", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    const result = await deleteChargeProvision(SOCIETY_ID, PROVISION_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans deleteChargeProvision", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.chargeProvision.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await deleteChargeProvision(SOCIETY_ID, PROVISION_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });

  it("retourne une erreur générique si la BDD échoue dans createChargeProvision (lignes 63-64)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "Taxe foncière",
      monthlyAmount: 85,
      vatRate: 10,
      startDate: "2026-01-01",
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la création" });
  });

  it("retourne une erreur si rôle insuffisant pour createChargeProvision (ForbiddenError lignes 62-64)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "Taxe foncière",
      monthlyAmount: 85,
      vatRate: 10,
      startDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur Zod si id invalide dans updateChargeProvision (ligne 77)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const result = await updateChargeProvision(SOCIETY_ID, { id: "not-a-cuid", label: "Test", monthlyAmount: 50, vatRate: 0, startDate: "2026-01-01" });
    expect(result.success).toBe(false);
  });

  it("createChargeProvision sans endDate → endDate null (B ligne 44 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.chargeProvision.create.mockResolvedValue({ id: PROVISION_ID } as never);

    const result = await createChargeProvision(SOCIETY_ID, {
      leaseId: LEASE_ID,
      lotId: LOT_ID,
      label: "Charge eau",
      monthlyAmount: 50,
      vatRate: 0,
      startDate: "2026-01-01",
      // pas d'endDate → arm1 → null
    });

    expect(result).toEqual({ success: true, data: { id: PROVISION_ID } });
    expect(prismaMock.chargeProvision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ endDate: null }) })
    );
  });

  it("updateChargeProvision avec endDate valide et sans isActive → isActive=true (B lignes 94 arm0, 95 arm1)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.chargeProvision.findFirst.mockResolvedValue({
      id: PROVISION_ID,
      lease: { societyId: SOCIETY_ID, id: LEASE_ID },
    } as never);
    prismaMock.chargeProvision.update.mockResolvedValue({ id: PROVISION_ID } as never);

    const result = await updateChargeProvision(SOCIETY_ID, {
      id: PROVISION_ID,
      label: "Provision avec fin",
      monthlyAmount: 60,
      vatRate: 0,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      // pas d'isActive → ?? true → arm1
    });

    expect(result).toEqual({ success: true, data: { id: PROVISION_ID } });
    expect(prismaMock.chargeProvision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endDate: new Date("2026-06-30"),
          isActive: true,
        }),
      })
    );
  });
});
