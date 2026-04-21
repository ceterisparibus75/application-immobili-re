import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { createPersonalSociety } from "./personal-society";

describe("personal-society actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur si l'utilisateur n'est pas authentifié", async () => {
    mockUnauthenticated();

    const result = await createPersonalSociety();

    expect(result).toEqual({
      success: false,
      error: "Non authentifie",
    });
  });

  it("valide le format du SIRET", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);

    const result = await createPersonalSociety({
      siret: "1234",
      taxRegime: "IR",
      vatRegime: "FRANCHISE",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Le SIRET doit contenir exactement 14 chiffres");
  });

  it("refuse de créer un espace si le SIRET existe déjà", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      firstName: "Test",
      lastName: "User",
      address: "1 rue de Paris",
      postalCode: "75001",
      ownerCity: "Paris",
      phone: "0102030405",
      email: "test@example.com",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue({ id: "society-existing" } as never);

    const result = await createPersonalSociety({
      siret: "12345678901234",
      taxRegime: "IR",
      vatRegime: "FRANCHISE",
    });

    expect(result).toEqual({
      success: false,
      error: "Ce SIRET est deja enregistre",
    });
    expect(prismaMock.society.create).not.toHaveBeenCalled();
  });

  it("crée l'espace propriétaire, l'adhésion, l'abonnement d'essai et l'audit", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      firstName: "Jeanne",
      lastName: "Martin",
      address: "1 rue de Paris",
      postalCode: "75001",
      ownerCity: "Paris",
      phone: "0102030405",
      email: "test@example.com",
    } as never);
    prismaMock.society.findUnique.mockResolvedValue(null);
    prismaMock.society.create.mockResolvedValue({
      id: "society-pp",
      name: "Jeanne Martin",
    } as never);

    const result = await createPersonalSociety({
      siret: "12345678901234",
      addressLine1: "  12 avenue Victor Hugo  ",
      postalCode: " 75016 ",
      city: " Paris ",
      taxRegime: "IS",
      vatRegime: "TVA",
      fiscalRegime: "LMNP_REEL",
    });

    expect(result).toEqual({
      success: true,
      data: { id: "society-pp" },
    });
    expect(prismaMock.society.create).toHaveBeenCalledWith({
      data: {
        name: "Jeanne Martin",
        legalForm: "PERSONNE_PHYSIQUE",
        siret: "12345678901234",
        addressLine1: "12 avenue Victor Hugo",
        city: "Paris",
        postalCode: "75016",
        country: "France",
        taxRegime: "IS",
        vatRegime: "TVA",
        fiscalRegime: "LMNP_REEL",
        phone: "0102030405",
        signatoryName: "Jeanne Martin",
        ownerId: "user-1",
        proprietaireId: null,
      },
    });
    expect(prismaMock.userSociety.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        societyId: "society-pp",
        role: "ADMIN_SOCIETE",
      },
    });
    expect(prismaMock.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: "society-pp",
        planId: "STARTER",
        status: "TRIALING",
        trialUsed: true,
        trialStart: expect.any(Date),
        trialEnd: expect.any(Date),
      }),
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: "society-pp",
      userId: "user-1",
      action: "CREATE",
      entity: "Society",
      entityId: "society-pp",
      details: { name: "Jeanne Martin", type: "PERSONNE_PHYSIQUE" },
    });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, "/", "layout");
    expect(revalidatePath).toHaveBeenNthCalledWith(2, "/societes");
    expect(revalidatePath).toHaveBeenNthCalledWith(3, "/dashboard");
  });
});
