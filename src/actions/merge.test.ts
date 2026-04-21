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

  it("retourne une recherche vide si non authentifié, sinon cherche les doublons", async () => {
    mockUnauthenticated();
    expect(await searchDuplicates(SOCIETY_ID, "tenant", "al")).toEqual([]);

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
});
