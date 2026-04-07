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

export type ProprietaireDetail = {
  id: string;
  label: string;
  entityType: ProprietaireEntityType;
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
};

export type CreateProprietaireInput = {
  label: string;
  entityType?: ProprietaireEntityType;
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
};

export type UpdateProprietaireInput = CreateProprietaireInput & { id: string };

// ── Actions ──

export async function getProprietaires(): Promise<ActionResult<ProprietaireListItem[]>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Non authentifié" };

  const proprietaires = await prisma.proprietaire.findMany({
    where: { userId: session.user.id },
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

  await prisma.proprietaire.update({
    where: { id: input.id },
    data: {
      label: input.label.trim(),
      entityType: input.entityType ?? undefined,
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

  const proprietaires = await prisma.proprietaire.findMany({
    where: { userId: session.user.id },
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
