import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));

import {
  claimSociety,
  getClaimableSocieties,
  getOwnerProfile,
  getOwnerSocieties,
  updateOwnerProfile,
} from "./owner";

describe("owner actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une erreur silencieuse non authentifiée pour les sociétés du propriétaire", async () => {
    mockUnauthenticated();

    const result = await getOwnerSocieties();

    expect(result).toEqual({
      success: false,
      error: "Non authentifie",
    });
  });

  it("liste les sociétés rattachées au propriétaire demandé", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.society.findMany.mockResolvedValue([
      {
        id: "society-1",
        name: "SCI Horizon",
        legalForm: "SCI",
        siret: "12345678901234",
        city: "Lyon",
        isActive: true,
        logoUrl: null,
      },
    ] as never);

    const result = await getOwnerSocieties("prop-1");

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "society-1",
          name: "SCI Horizon",
          legalForm: "SCI",
          siret: "12345678901234",
          city: "Lyon",
          isActive: true,
          logoUrl: null,
        },
      ],
    });
    expect(prismaMock.society.findMany).toHaveBeenCalledWith({
      where: { proprietaireId: "prop-1", proprietaire: { userId: "user-1" } },
      select: {
        id: true,
        name: true,
        legalForm: true,
        siret: true,
        city: true,
        isActive: true,
        logoUrl: true,
      },
      orderBy: { name: "asc" },
    });
  });

  it("retourne les sociétés revendicables où l'utilisateur est admin", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findMany.mockResolvedValue([
      {
        society: {
          id: "society-2",
          name: "SARL Atlas",
          legalForm: "SARL",
          siret: null,
          city: "Marseille",
        },
      },
    ] as never);

    const result = await getClaimableSocieties();

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "society-2",
          name: "SARL Atlas",
          legalForm: "SARL",
          siret: null,
          city: "Marseille",
        },
      ],
    });
    expect(prismaMock.userSociety.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        role: { in: ["ADMIN_SOCIETE", "SUPER_ADMIN"] },
        society: { ownerId: null },
      },
      select: {
        society: {
          select: { id: true, name: true, legalForm: true, siret: true, city: true },
        },
      },
    });
  });

  it("refuse de rattacher une société si l'utilisateur n'est pas administrateur", async () => {
    mockAuthSession(UserRole.GESTIONNAIRE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "GESTIONNAIRE" } as never);

    const result = await claimSociety("society-3");

    expect(result).toEqual({
      success: false,
      error: "Vous devez etre administrateur de cette societe pour la rattacher",
    });
    expect(prismaMock.society.update).not.toHaveBeenCalled();
  });

  it("refuse de rattacher une société qui a déjà un propriétaire", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      ownerId: "user-existing",
      name: "SCI Déjà prise",
    } as never);

    const result = await claimSociety("society-4");

    expect(result).toEqual({
      success: false,
      error: "Cette societe a deja un proprietaire",
    });
  });

  it("rattache une société libre au propriétaire demandé", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.userSociety.findUnique.mockResolvedValue({ role: "ADMIN_SOCIETE" } as never);
    prismaMock.society.findUnique.mockResolvedValue({
      ownerId: null,
      name: "SCI Libre",
    } as never);
    prismaMock.proprietaire.findFirst.mockResolvedValue({ id: "prop-9" } as never);

    const result = await claimSociety("society-5", "prop-9");

    expect(result).toEqual({ success: true });
    expect(prismaMock.society.update).toHaveBeenCalledWith({
      where: { id: "society-5" },
      data: {
        ownerId: "user-1",
        proprietaireId: "prop-9",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/proprietaire");
  });

  it("retourne le profil propriétaire courant", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);
    prismaMock.user.findUnique.mockResolvedValue({
      email: "owner@example.com",
      firstName: "Alice",
      lastName: "Durand",
      phone: "0102030405",
      birthDate: null,
      birthPlace: null,
      address: "1 rue de Lille",
      postalCode: "59000",
      ownerCity: "Lille",
      profession: "Architecte",
      nationality: "Française",
      company: "AD Conseil",
      emailCopyEnabled: true,
      emailCopyAddress: "copie@example.com",
    } as never);

    const result = await getOwnerProfile();

    expect(result).toEqual({
      success: true,
      data: {
        email: "owner@example.com",
        firstName: "Alice",
        lastName: "Durand",
        phone: "0102030405",
        birthDate: null,
        birthPlace: null,
        address: "1 rue de Lille",
        postalCode: "59000",
        ownerCity: "Lille",
        profession: "Architecte",
        nationality: "Française",
        company: "AD Conseil",
        emailCopyEnabled: true,
        emailCopyAddress: "copie@example.com",
      },
    });
  });

  it("valide prénom et nom avant mise à jour du profil", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);

    const result = await updateOwnerProfile({
      firstName: " ",
      lastName: "Durand",
    });

    expect(result).toEqual({
      success: false,
      error: "Le prenom et le nom sont obligatoires",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("met à jour le profil propriétaire avec des valeurs nettoyées", async () => {
    mockAuthSession(UserRole.ADMIN_SOCIETE);

    const result = await updateOwnerProfile({
      firstName: " Alice ",
      lastName: " Durand ",
      phone: " 0102030405 ",
      birthDate: "2020-01-15",
      birthPlace: " Lille ",
      address: " 1 rue de Lille ",
      postalCode: " 59000 ",
      ownerCity: " Lille ",
      profession: " Architecte ",
      nationality: " Française ",
      company: " AD Conseil ",
      emailCopyEnabled: true,
      emailCopyAddress: " copie@example.com ",
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        firstName: "Alice",
        lastName: "Durand",
        name: "Alice Durand",
        phone: "0102030405",
        birthDate: new Date("2020-01-15"),
        birthPlace: "Lille",
        address: "1 rue de Lille",
        postalCode: "59000",
        ownerCity: "Lille",
        profession: "Architecte",
        nationality: "Française",
        company: "AD Conseil",
        emailCopyEnabled: true,
        emailCopyAddress: "copie@example.com",
      },
    });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, "/proprietaire");
    expect(revalidatePath).toHaveBeenNthCalledWith(2, "/", "layout");
  });
});
