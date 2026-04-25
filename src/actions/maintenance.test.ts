import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createMaintenance,
  deleteMaintenance,
  updateMaintenance,
} from "./maintenance";

const SOCIETY_ID = "society-1";
const BUILDING_ID = "cm8m6m6m6000008l2a1bcdefg";
const MAINTENANCE_ID = "cm8m6m6m6000008l2a1bcdefh";

describe("maintenance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();

    const result = await createMaintenance(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      title: "Réparation chaudière",
      isPaid: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne une erreur si l'immeuble n'existe pas", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue(null);

    const result = await createMaintenance(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      title: "Réparation chaudière",
      isPaid: false,
    });

    expect(result).toEqual({ success: false, error: "Immeuble introuvable" });
  });

  it("crée une intervention avec conversion des dates et audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.maintenance.create.mockResolvedValue({
      id: MAINTENANCE_ID,
      title: "Réparation chaudière",
      buildingId: BUILDING_ID,
    } as never);

    const result = await createMaintenance(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      title: "Réparation chaudière",
      scheduledAt: "2026-05-01",
      completedAt: "2026-05-03",
      cost: 320,
      isPaid: "on",
      notes: "Urgent",
    } as never);

    expect(result).toEqual({ success: true, data: { id: MAINTENANCE_ID } });
    expect(prismaMock.maintenance.create).toHaveBeenCalledWith({
      data: {
        buildingId: BUILDING_ID,
        lotId: null,
        title: "Réparation chaudière",
        description: null,
        scheduledAt: new Date("2026-05-01"),
        completedAt: new Date("2026-05-03"),
        cost: 320,
        isPaid: true,
        notes: "Urgent",
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Maintenance",
        entityId: MAINTENANCE_ID,
      })
    );
  });

  it("met à jour puis supprime une intervention existante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.maintenance.findFirst
      .mockResolvedValueOnce({ id: MAINTENANCE_ID, buildingId: BUILDING_ID } as never)
      .mockResolvedValueOnce({ id: MAINTENANCE_ID, buildingId: BUILDING_ID } as never);

    const updateResult = await updateMaintenance(SOCIETY_ID, {
      id: MAINTENANCE_ID,
      title: "Réparation finalisée",
      completedAt: "2026-05-04",
    });
    const deleteResult = await deleteMaintenance(SOCIETY_ID, MAINTENANCE_ID);

    expect(updateResult).toEqual({ success: true });
    expect(prismaMock.maintenance.update).toHaveBeenCalledWith({
      where: { id: MAINTENANCE_ID },
      data: {
        title: "Réparation finalisée",
        completedAt: new Date("2026-05-04"),
        scheduledAt: null,
      },
    });
    expect(deleteResult).toEqual({ success: true });
    expect(prismaMock.maintenance.delete).toHaveBeenCalledWith({
      where: { id: MAINTENANCE_ID },
    });
  });

  it("retourne une erreur si updateMaintenance ne trouve pas l'intervention", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.maintenance.findFirst.mockResolvedValue(null);

    const result = await updateMaintenance(SOCIETY_ID, {
      id: MAINTENANCE_ID,
      title: "Titre quelconque",
    });

    expect(result).toEqual({ success: false, error: "Intervention introuvable" });
  });

  it("retourne une erreur si deleteMaintenance ne trouve pas l'intervention", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.maintenance.findFirst.mockResolvedValue(null);

    const result = await deleteMaintenance(SOCIETY_ID, MAINTENANCE_ID);

    expect(result).toEqual({ success: false, error: "Intervention introuvable" });
  });

  it("retourne non authentifié pour updateMaintenance", async () => {
    mockUnauthenticated();
    const result = await updateMaintenance(SOCIETY_ID, { id: MAINTENANCE_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne non authentifié pour deleteMaintenance", async () => {
    mockUnauthenticated();
    const result = await deleteMaintenance(SOCIETY_ID, MAINTENANCE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne une erreur si rôle insuffisant pour updateMaintenance", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await updateMaintenance(SOCIETY_ID, { id: MAINTENANCE_ID, title: "Test" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateMaintenance", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.maintenance.findFirst.mockResolvedValue({ id: MAINTENANCE_ID, buildingId: BUILDING_ID } as never);
    prismaMock.maintenance.update.mockRejectedValue(new Error("DB connection lost"));

    const result = await updateMaintenance(SOCIETY_ID, { id: MAINTENANCE_ID, title: "Test" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });

  it("retourne une erreur si rôle insuffisant pour deleteMaintenance", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await deleteMaintenance(SOCIETY_ID, MAINTENANCE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans deleteMaintenance", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.maintenance.findFirst.mockResolvedValue({ id: MAINTENANCE_ID, buildingId: BUILDING_ID } as never);
    prismaMock.maintenance.delete.mockRejectedValue(new Error("DB connection lost"));

    const result = await deleteMaintenance(SOCIETY_ID, MAINTENANCE_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la suppression" });
  });

  it("retourne une erreur si rôle insuffisant pour createMaintenance", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createMaintenance(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      title: "Réparation chaudière",
      isPaid: false,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createMaintenance", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.maintenance.create.mockRejectedValue(new Error("DB connection lost"));

    const result = await createMaintenance(SOCIETY_ID, {
      buildingId: BUILDING_ID,
      title: "Réparation chaudière",
      isPaid: false,
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la création de l'intervention" });
  });
});
