"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { ProprietaireEntityType } from "@/generated/prisma/client";

// ── Types ──

export type ProprietaireListItem = {
  id: string;
  label: string;
  entityType: ProprietaireEntityType;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  legalForm: string | null;
  city: string | null;
  societyCount: number;
  createdAt: Date;
};

export type ProprietaireAssocie = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  nationality: string | null;
  profession: string | null;
  share: string | null;
  role: string | null;
};

export type ProprietaireDetail = {
  id: string;
  label: string;
  entityType: ProprietaireEntityType;
  email: string | null;
  // Personne physique
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: Date | null;
  birthPlace: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  profession: string | null;
  nationality: string | null;
  // Personne morale
  companyName: string | null;
  legalForm: string | null;
  siret: string | null;
  siren: string | null;
  vatNumber: string | null;
  shareCapital: number | null;
  registrationCity: string | null;
  representativeName: string | null;
  representativeRole: string | null;
  // Associés
  associes: ProprietaireAssocie[];
};

export type AssocieInput = {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  profession?: string;
  share?: string;
  role?: string;
};

export type CreateProprietaireInput = {
  label: string;
  entityType?: ProprietaireEntityType;
  email?: string;
  // Personne physique
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthDate?: string;
  birthPlace?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  profession?: string;
  nationality?: string;
  // Personne morale
  companyName?: string;
  legalForm?: string;
  siret?: string;
  siren?: string;
  vatNumber?: string;
  shareCapital?: number;
  registrationCity?: string;
  representativeName?: string;
  representativeRole?: string;
  // Associés
  associes?: AssocieInput[];
};

export type UpdateProprietaireInput = CreateProprietaireInput & { id: string };

// ── Actions ──

export async function getProprietaires(): Promise<ActionResult<ProprietaireListItem[]>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  const proprietaires = await prisma.proprietaire.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        {
          societies: {
            some: {
              userSocieties: {
                some: { userId: session.user.id },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      label: true,
      entityType: true,
      firstName: true,
      lastName: true,
      companyName: true,
      legalForm: true,
      city: true,
      createdAt: true,
      _count: { select: { societies: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    success: true,
    data: proprietaires.map((p) => ({
      id: p.id,
      label: p.label,
      entityType: p.entityType,
      firstName: p.firstName,
      lastName: p.lastName,
      companyName: p.companyName,
      legalForm: p.legalForm,
      city: p.city,
      societyCount: p._count.societies,
      createdAt: p.createdAt,
    })),
  };
}

export async function getProprietaire(proprietaireId: string): Promise<ActionResult<ProprietaireDetail>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  const proprietaire = await prisma.proprietaire.findFirst({
    where: {
      id: proprietaireId,
      OR: [
        { userId: session.user.id },
        {
          societies: {
            some: {
              userSocieties: {
                some: {
                  userId: session.user.id,
                  role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE"] },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      label: true,
      entityType: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      birthDate: true,
      birthPlace: true,
      address: true,
      postalCode: true,
      city: true,
      profession: true,
      nationality: true,
      companyName: true,
      legalForm: true,
      siret: true,
      siren: true,
      vatNumber: true,
      shareCapital: true,
      registrationCity: true,
      representativeName: true,
      representativeRole: true,
      associes: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          birthDate: true,
          birthPlace: true,
          nationality: true,
          profession: true,
          share: true,
          role: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!proprietaire) return { success: false, error: "Propriétaire introuvable" };
  return { success: true, data: proprietaire };
}

export async function createProprietaire(input: CreateProprietaireInput): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  if (!input.label?.trim()) {
    return { success: false, error: "Le libellé est obligatoire" };
  }

  const proprietaire = await prisma.proprietaire.create({
    data: {
      userId: session.user.id,
      label: input.label.trim(),
      entityType: input.entityType ?? "PERSONNE_PHYSIQUE",
      email: input.email?.trim() || null,
      // Personne physique
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      birthPlace: input.birthPlace?.trim() || null,
      address: input.address?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      city: input.city?.trim() || null,
      profession: input.profession?.trim() || null,
      nationality: input.nationality?.trim() || null,
      // Personne morale
      companyName: input.companyName?.trim() || null,
      legalForm: input.legalForm?.trim() || null,
      siret: input.siret?.trim() || null,
      siren: input.siren?.trim() || null,
      vatNumber: input.vatNumber?.trim() || null,
      shareCapital: input.shareCapital ?? null,
      registrationCity: input.registrationCity?.trim() || null,
      representativeName: input.representativeName?.trim() || null,
      representativeRole: input.representativeRole?.trim() || null,
      // Associés
      ...(input.associes && input.associes.length > 0
        ? {
            associes: {
              create: input.associes.map((a) => ({
                firstName: a.firstName.trim(),
                lastName: a.lastName.trim(),
                email: a.email?.trim() || null,
                phone: a.phone?.trim() || null,
                birthDate: a.birthDate ? new Date(a.birthDate) : null,
                birthPlace: a.birthPlace?.trim() || null,
                nationality: a.nationality?.trim() || null,
                profession: a.profession?.trim() || null,
                share: a.share?.trim() || null,
                role: a.role?.trim() || null,
              })),
            },
          }
        : {}),
    },
  });

  revalidatePath("/proprietaire");
  return { success: true, data: { id: proprietaire.id } };
}

export async function updateProprietaire(input: UpdateProprietaireInput): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  if (!input.label?.trim()) {
    return { success: false, error: "Le libellé est obligatoire" };
  }

  // Vérifier que l'utilisateur est créateur du propriétaire OU admin d'une de ses sociétés
  const existing = await prisma.proprietaire.findFirst({
    where: {
      id: input.id,
      OR: [
        { userId: session.user.id },
        {
          societies: {
            some: {
              userSocieties: {
                some: {
                  userId: session.user.id,
                  role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE"] },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!existing) return { success: false, error: "Propriétaire introuvable ou accès refusé" };

  // Mettre à jour le propriétaire
  await prisma.proprietaire.update({
    where: { id: input.id },
    data: {
      label: input.label.trim(),
      entityType: input.entityType ?? undefined,
      email: input.email?.trim() || null,
      // Personne physique
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      birthPlace: input.birthPlace?.trim() || null,
      address: input.address?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      city: input.city?.trim() || null,
      profession: input.profession?.trim() || null,
      nationality: input.nationality?.trim() || null,
      // Personne morale
      companyName: input.companyName?.trim() || null,
      legalForm: input.legalForm?.trim() || null,
      siret: input.siret?.trim() || null,
      siren: input.siren?.trim() || null,
      vatNumber: input.vatNumber?.trim() || null,
      shareCapital: input.shareCapital ?? null,
      registrationCity: input.registrationCity?.trim() || null,
      representativeName: input.representativeName?.trim() || null,
      representativeRole: input.representativeRole?.trim() || null,
    },
  });

  // Gérer les associés si fournis
  if (input.associes !== undefined) {
    // Récupérer les associés existants
    const existingAssocies = await prisma.proprietaireAssocie.findMany({
      where: { proprietaireId: input.id },
      select: { id: true },
    });
    const existingIds = new Set(existingAssocies.map((a) => a.id));
    const inputIds = new Set(input.associes.filter((a) => a.id).map((a) => a.id!));

    // Supprimer les associés qui ne sont plus dans la liste
    const toDelete = [...existingIds].filter((id) => !inputIds.has(id));
    if (toDelete.length > 0) {
      await prisma.proprietaireAssocie.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Créer ou mettre à jour les associés
    for (const associe of input.associes) {
      if (associe.id && existingIds.has(associe.id)) {
        // Mise à jour
        await prisma.proprietaireAssocie.update({
          where: { id: associe.id },
          data: {
            firstName: associe.firstName.trim(),
            lastName: associe.lastName.trim(),
            email: associe.email?.trim() || null,
            phone: associe.phone?.trim() || null,
            birthDate: associe.birthDate ? new Date(associe.birthDate) : null,
            birthPlace: associe.birthPlace?.trim() || null,
            nationality: associe.nationality?.trim() || null,
            profession: associe.profession?.trim() || null,
            share: associe.share?.trim() || null,
            role: associe.role?.trim() || null,
          },
        });
      } else {
        // Création
        await prisma.proprietaireAssocie.create({
          data: {
            proprietaireId: input.id,
            firstName: associe.firstName.trim(),
            lastName: associe.lastName.trim(),
            email: associe.email?.trim() || null,
            phone: associe.phone?.trim() || null,
            birthDate: associe.birthDate ? new Date(associe.birthDate) : null,
            birthPlace: associe.birthPlace?.trim() || null,
            nationality: associe.nationality?.trim() || null,
            profession: associe.profession?.trim() || null,
            share: associe.share?.trim() || null,
            role: associe.role?.trim() || null,
          },
        });
      }
    }
  }

  revalidatePath("/proprietaire");
  return { success: true };
}

export async function deleteProprietaire(proprietaireId: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  const proprietaire = await prisma.proprietaire.findFirst({
    where: { id: proprietaireId, userId: session.user.id },
    select: { id: true, _count: { select: { societies: true } } },
  });

  if (!proprietaire) return { success: false, error: "Propriétaire introuvable" };
  if (proprietaire._count.societies > 0) {
    return { success: false, error: "Impossible de supprimer un propriétaire ayant des sociétés rattachées" };
  }

  await prisma.proprietaire.delete({ where: { id: proprietaireId } });

  revalidatePath("/proprietaire");
  return { success: true };
}

/**
 * Migre les sociétés existantes (liées par ownerId) vers un Proprietaire.
 * Crée un Proprietaire par défaut si l'utilisateur n'en a pas encore.
 */
export async function migrateOwnerToProprietaire(): Promise<ActionResult<{ proprietaireId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  // Vérifier s'il existe déjà un propriétaire pour cet utilisateur
  let proprietaire = await prisma.proprietaire.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!proprietaire) {
    // Récupérer le profil utilisateur pour pré-remplir
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true, lastName: true, phone: true,
        birthDate: true, birthPlace: true, address: true,
        postalCode: true, ownerCity: true, profession: true, nationality: true,
      },
    });

    proprietaire = await prisma.proprietaire.create({
      data: {
        userId: session.user.id,
        label: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : "Mon patrimoine",
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        phone: user?.phone ?? null,
        birthDate: user?.birthDate ?? null,
        birthPlace: user?.birthPlace ?? null,
        address: user?.address ?? null,
        postalCode: user?.postalCode ?? null,
        city: user?.ownerCity ?? null,
        profession: user?.profession ?? null,
        nationality: user?.nationality ?? null,
      },
    });
  }

  // Migrer les sociétés qui ont ownerId mais pas proprietaireId
  await prisma.society.updateMany({
    where: {
      ownerId: session.user.id,
      proprietaireId: null,
    },
    data: {
      proprietaireId: proprietaire.id,
    },
  });

  revalidatePath("/proprietaire");
  return { success: true, data: { proprietaireId: proprietaire.id } };
}

/**
 * Récupère les propriétaires avec leurs sociétés pour la navigation
 */
export async function getProprietairesWithSocieties(): Promise<ActionResult<{
  id: string;
  label: string;
  displayName: string;
  entityType: string;
  legalForm: string | null;
  societies: { id: string; name: string; legalForm: string; city: string; isActive: boolean; logoUrl: string | null }[];
}[]>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  // Auto-migration : créer le propriétaire et rattacher les sociétés si nécessaire
  const existingProprietaire = await prisma.proprietaire.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!existingProprietaire) {
    // Vérifier si l'utilisateur a des sociétés sans propriétaire
    const orphanSocieties = await prisma.society.findMany({
      where: { ownerId: session.user.id, proprietaireId: null },
      select: { id: true },
    });
    if (orphanSocieties.length > 0) {
      await migrateOwnerToProprietaire();
    }
  } else {
    // Si le propriétaire existe mais des sociétés ne sont pas rattachées
    const orphans = await prisma.society.findMany({
      where: { ownerId: session.user.id, proprietaireId: null },
      select: { id: true },
    });
    if (orphans.length > 0) {
      await prisma.society.updateMany({
        where: { ownerId: session.user.id, proprietaireId: null },
        data: { proprietaireId: existingProprietaire.id },
      });
    }
  }

  // Inclure les propriétaires créés par l'utilisateur OU accessibles via une société
  const proprietaires = await prisma.proprietaire.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        {
          societies: {
            some: {
              userSocieties: {
                some: { userId: session.user.id },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      label: true,
      entityType: true,
      firstName: true,
      lastName: true,
      companyName: true,
      legalForm: true,
      societies: {
        select: { id: true, name: true, legalForm: true, city: true, isActive: true, logoUrl: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    success: true,
    data: proprietaires.map((p) => ({
      id: p.id,
      label: p.label,
      displayName: p.entityType === "PERSONNE_MORALE"
        ? (p.companyName ?? p.label)
        : [p.firstName, p.lastName].filter(Boolean).join(" ") || p.label,
      entityType: p.entityType,
      legalForm: p.legalForm,
      societies: p.societies,
    })),
  };
}
