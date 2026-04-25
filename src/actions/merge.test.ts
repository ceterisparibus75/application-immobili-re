import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  mergeBuildings,
  mergeLots,
  mergeTenants,
  searchDuplicates,
} from "./merge";

const SOCIETY_ID = "cm8m6m6m6000008l2a1bcdefg";
const SOURCE_ID = "cm8m6m6m6000008l2a1bcdefh";
const TARGET_ID = "cm8m6m6m6000008l2a1bcdefi";

describe("merge actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloque la fusion d'un immeuble avec lui-même", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);

    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, SOURCE_ID);

    expect(result).toEqual({
      success: false,
      error: "Impossible de fusionner un immeuble avec lui-même",
    });
  });

  it("fusionne deux immeubles et journalise l'opération", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.building.findFirst
      .mockResolvedValueOnce({ id: SOURCE_ID, name: "Immeuble Source" } as never)
      .mockResolvedValueOnce({ id: TARGET_ID, name: "Immeuble Cible" } as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, TARGET_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "Building",
        entityId: TARGET_ID,
        details: expect.objectContaining({
          action: "merge",
          mergedFrom: { id: SOURCE_ID, name: "Immeuble Source" },
          mergedInto: { id: TARGET_ID, name: "Immeuble Cible" },
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/patrimoine/immeubles");
    expect(revalidatePath).toHaveBeenCalledWith(`/patrimoine/immeubles/${TARGET_ID}`);
  });

  it("fusionne deux locataires après suppression du portail source", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.tenant.findFirst
      .mockResolvedValueOnce({
        id: SOURCE_ID,
        entityType: "PERSONNE_PHYSIQUE",
        firstName: "Alice",
        lastName: "Durand",
      } as never)
      .mockResolvedValueOnce({
        id: TARGET_ID,
        entityType: "PERSONNE_MORALE",
        companyName: "ACME SAS",
      } as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, TARGET_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.tenantPortalAccess.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: SOURCE_ID },
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "Tenant",
        entityId: TARGET_ID,
        details: expect.objectContaining({
          mergedFrom: { id: SOURCE_ID, name: "Alice Durand" },
          mergedInto: { id: TARGET_ID, name: "ACME SAS" },
        }),
      })
    );
  });

  it("retourne une erreur si l'immeuble source est introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.building.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: TARGET_ID, name: "Cible" } as never);

    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Immeuble source introuvable" });
  });

  it("retourne une erreur si l'immeuble cible est introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.building.findFirst
      .mockResolvedValueOnce({ id: SOURCE_ID, name: "Source" } as never)
      .mockResolvedValueOnce(null);

    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Immeuble cible introuvable" });
  });

  it("bloque la fusion d'un lot avec lui-même", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, SOURCE_ID);
    expect(result).toEqual({ success: false, error: "Impossible de fusionner un lot avec lui-même" });
  });

  it("retourne une erreur si le lot source est introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.lot.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: TARGET_ID, number: "B02", buildingId: "bld-1" } as never);

    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Lot source introuvable" });
  });

  it("fusionne deux lots et journalise l'opération", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.lot.findFirst
      .mockResolvedValueOnce({ id: SOURCE_ID, number: "A01", buildingId: "bld-1", building: { societyId: SOCIETY_ID } } as never)
      .mockResolvedValueOnce({ id: TARGET_ID, number: "B02", buildingId: "bld-1", building: { societyId: SOCIETY_ID } } as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, TARGET_ID);

    expect(result).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "Lot",
        entityId: TARGET_ID,
        details: expect.objectContaining({
          action: "merge",
          mergedFrom: { id: SOURCE_ID, number: "A01" },
          mergedInto: { id: TARGET_ID, number: "B02" },
        }),
      })
    );
  });

  it("bloque la fusion d'un locataire avec lui-même", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, SOURCE_ID);
    expect(result).toEqual({ success: false, error: "Impossible de fusionner un locataire avec lui-même" });
  });

  it("retourne une erreur si le locataire source est introuvable", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.tenant.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: TARGET_ID, entityType: "PERSONNE_PHYSIQUE", firstName: "Bob", lastName: "Dupont" } as never);

    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Locataire source introuvable" });
  });

  it("retourne une recherche vide si requête trop courte", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    expect(await searchDuplicates(SOCIETY_ID, "building", "a")).toEqual([]);
  });

  it("retourne une recherche vide si non authentifié", async () => {
    mockUnauthenticated();
    expect(await searchDuplicates(SOCIETY_ID, "tenant", "al")).toEqual([]);
  });

  it("recherche des doublons de locataires", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: TARGET_ID,
        entityType: "PERSONNE_PHYSIQUE",
        companyName: null,
        firstName: "Alice",
        lastName: "Durand",
        email: "alice@example.com",
      },
    ] as never);

    const result = await searchDuplicates(SOCIETY_ID, "tenant", "ali");

    expect(result).toEqual([
      {
        id: TARGET_ID,
        entityType: "PERSONNE_PHYSIQUE",
        companyName: null,
        firstName: "Alice",
        lastName: "Durand",
        email: "alice@example.com",
      },
    ]);
  });

  it("recherche des doublons d'immeubles", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.building.findMany.mockResolvedValue([
      { id: SOURCE_ID, name: "Résidence Atlas", addressLine1: "1 rue de Lyon", city: "Lyon" },
    ] as never);

    const result = await searchDuplicates(SOCIETY_ID, "building", "Atlas");

    expect(result).toEqual([
      { id: SOURCE_ID, name: "Résidence Atlas", addressLine1: "1 rue de Lyon", city: "Lyon" },
    ]);
  });

  it("recherche des doublons de lots", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    prismaMock.lot.findMany.mockResolvedValue([
      { id: SOURCE_ID, number: "A01", lotType: "APPARTEMENT", building: { name: "Résidence Atlas" } },
    ] as never);

    const result = await searchDuplicates(SOCIETY_ID, "lot", "A01");

    expect(result).toEqual([
      { id: SOURCE_ID, number: "A01", lotType: "APPARTEMENT", building: { name: "Résidence Atlas" } },
    ]);
  });

  it("retourne [] pour un type inconnu dans searchDuplicates", async () => {
    mockAuthSession(UserRole.LECTURE, SOCIETY_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await searchDuplicates(SOCIETY_ID, "unknown" as any, "query");
    expect(result).toEqual([]);
  });

  it("retourne UnauthenticatedActionError si non authentifié pour mergeBuildings (ligne 74)", async () => {
    mockUnauthenticated();
    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result.success).toBe(false);
  });

  it("retourne ForbiddenError si rôle insuffisant pour mergeBuildings (ligne 75)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur si le lot cible est introuvable (ligne 102)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.lot.findFirst
      .mockResolvedValueOnce({ id: SOURCE_ID, number: "A01", buildingId: "bld-1", building: { societyId: SOCIETY_ID } } as never)
      .mockResolvedValueOnce(null);
    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Lot cible introuvable" });
  });

  it("retourne UnauthenticatedActionError si non authentifié pour mergeLots (ligne 141)", async () => {
    mockUnauthenticated();
    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result.success).toBe(false);
  });

  it("retourne ForbiddenError si rôle insuffisant pour mergeLots (ligne 142)", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retourne une erreur si le locataire cible est introuvable (ligne 169)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.tenant.findFirst
      .mockResolvedValueOnce({ id: SOURCE_ID, entityType: "PERSONNE_PHYSIQUE", firstName: "Alice", lastName: "Durand" } as never)
      .mockResolvedValueOnce(null);
    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Locataire cible introuvable" });
  });

  it("retourne UnauthenticatedActionError si non authentifié pour mergeTenants (ligne 218)", async () => {
    mockUnauthenticated();
    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur générique si la BDD échoue dans mergeBuildings (lignes 74-77)", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.building.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await mergeBuildings(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la fusion des immeubles" });
  });

  it("retourne une erreur générique si la BDD échoue dans mergeLots", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.lot.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await mergeLots(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la fusion des lots" });
  });

  it("retourne une erreur si rôle insuffisant pour mergeTenants", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE, SOCIETY_ID);
    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisantes|refus/i);
  });

  it("retourne une erreur générique si la BDD échoue dans mergeTenants", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE, SOCIETY_ID);
    prismaMock.tenant.findFirst.mockRejectedValue(new Error("DB connection lost"));
    const result = await mergeTenants(SOCIETY_ID, SOURCE_ID, TARGET_ID);
    expect(result).toEqual({ success: false, error: "Erreur lors de la fusion des locataires" });
  });
});
