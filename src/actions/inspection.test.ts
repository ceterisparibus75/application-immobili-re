import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  createInspection,
  getInspectionById,
  getInspectionsByLease,
  updateInspection,
} from "./inspection";

const SOCIETY_ID = "society-1";
const LEASE_ID = "cm8m6m6m6000008l2a1bcdefg";
const INSPECTION_ID = "cm8m6m6m6000008l2a1bcdefh";

describe("inspection actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur de validation si l'inspection à créer est invalide", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);

    const result = await createInspection(SOCIETY_ID, {
      leaseId: "invalid",
      type: "ENTREE",
      performedAt: "",
      rooms: [{ name: "", condition: "BON" }],
    } as never);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid cuid");
    expect(result.error).toContain("La date est requise");
    expect(result.error).toContain("Le nom de la pièce est requis");
  });

  it("crée une inspection avec ses pièces et écrit un audit", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue({ id: LEASE_ID } as never);
    prismaMock.inspection.create.mockResolvedValue({ id: INSPECTION_ID } as never);

    const result = await createInspection(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "ENTREE",
      performedAt: "2026-04-20",
      performedBy: "Alice",
      generalNotes: "RAS",
      rooms: [{ name: "Salon", condition: "BON", notes: "Très propre" }],
    });

    expect(result).toEqual({ success: true, data: { id: INSPECTION_ID } });
    expect(prismaMock.inspection.create).toHaveBeenCalledWith({
      data: {
        leaseId: LEASE_ID,
        type: "ENTREE",
        performedAt: new Date("2026-04-20"),
        performedBy: "Alice",
        generalNotes: "RAS",
        rooms: {
          create: [{ name: "Salon", condition: "BON", notes: "Très propre" }],
        },
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId: SOCIETY_ID,
        userId: "user-1",
        action: "CREATE",
        entity: "Inspection",
        entityId: INSPECTION_ID,
      })
    );
  });

  it("met à jour une inspection existante", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.inspection.findFirst.mockResolvedValue({
      id: INSPECTION_ID,
      leaseId: LEASE_ID,
    } as never);

    const result = await updateInspection(SOCIETY_ID, {
      id: INSPECTION_ID,
      performedBy: "Bob",
      generalNotes: "Signature reçue",
      signedFileUrl: "https://files.test/signed.pdf",
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.inspection.update).toHaveBeenCalledWith({
      where: { id: INSPECTION_ID },
      data: {
        performedBy: "Bob",
        generalNotes: "Signature reçue",
        signedFileUrl: "https://files.test/signed.pdf",
      },
    });
  });

  it("retourne des lectures silencieuses si non authentifié", async () => {
    mockUnauthenticated();

    const list = await getInspectionsByLease(SOCIETY_ID, LEASE_ID);
    const item = await getInspectionById(SOCIETY_ID, INSPECTION_ID);

    expect(list).toEqual([]);
    expect(item).toBeNull();
  });

  it("retourne une erreur si le bail est introuvable lors de createInspection", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockResolvedValue(null);

    const result = await createInspection(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "ENTREE",
      performedAt: "2026-04-20",
      rooms: [{ name: "Cuisine", condition: "BON" }],
    });

    expect(result).toEqual({ success: false, error: "Bail introuvable" });
  });

  it("retourne une erreur si l'inspection est introuvable lors de updateInspection", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.inspection.findFirst.mockResolvedValue(null);

    const result = await updateInspection(SOCIETY_ID, {
      id: INSPECTION_ID,
      performedBy: "Alice",
    });

    expect(result).toEqual({ success: false, error: "Inspection introuvable" });
  });

  it("retourne non authentifié pour createInspection", async () => {
    mockUnauthenticated();

    const result = await createInspection(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "ENTREE",
      performedAt: "2026-04-20",
      rooms: [{ name: "Salon", condition: "BON" }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne non authentifié pour updateInspection", async () => {
    mockUnauthenticated();

    const result = await updateInspection(SOCIETY_ID, { id: INSPECTION_ID });

    expect(result.success).toBe(false);
    expect(result.error).toContain("authentifié");
  });

  it("retourne les inspections pour un bail authentifié", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.inspection.findMany.mockResolvedValue([
      { id: INSPECTION_ID, leaseId: LEASE_ID, type: "ENTREE" },
    ] as never);

    const list = await getInspectionsByLease(SOCIETY_ID, LEASE_ID);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(INSPECTION_ID);
  });

  it("retourne une inspection par son ID", async () => {
    mockAuthSession(UserRole.LECTURE);
    prismaMock.inspection.findFirst.mockResolvedValue({
      id: INSPECTION_ID,
      leaseId: LEASE_ID,
      type: "SORTIE",
      rooms: [],
    } as never);

    const item = await getInspectionById(SOCIETY_ID, INSPECTION_ID);

    expect(item?.id).toBe(INSPECTION_ID);
  });

  it("retourne une erreur si rôle insuffisant pour updateInspection", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await updateInspection(SOCIETY_ID, { id: INSPECTION_ID, generalNotes: "test" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans updateInspection", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.inspection.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await updateInspection(SOCIETY_ID, { id: INSPECTION_ID, generalNotes: "test" });
    expect(result).toEqual({ success: false, error: "Erreur lors de la mise à jour" });
  });

  it("retourne une erreur si rôle insuffisant pour createInspection", async () => {
    mockAuthSession(UserRole.LECTURE);
    const result = await createInspection(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "ENTREE",
      performedAt: "2026-04-20",
      rooms: [{ name: "Salon", condition: "BON" }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans createInspection", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.lease.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await createInspection(SOCIETY_ID, {
      leaseId: LEASE_ID,
      type: "ENTREE",
      performedAt: "2026-04-20",
      rooms: [{ name: "Salon", condition: "BON" }],
    });
    expect(result).toEqual({ success: false, error: "Erreur lors de la création" });
  });

  it("retourne une erreur Zod si l'id est invalide dans updateInspection", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    const result = await updateInspection(SOCIETY_ID, { id: "not-a-cuid" });
    expect(result.success).toBe(false);
  });
});
