import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 50,
  ADMIN_SOCIETE: 40,
  GESTIONNAIRE: 30,
  COMPTABLE: 20,
  LECTURE: 10,
};

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Ressource introuvable") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Vérifie qu'un utilisateur a accès à une société donnée,
 * et optionnellement qu'il a un rôle minimum.
 */
export async function requireSocietyAccess(
  userId: string,
  societyId: string,
  minRole?: UserRole
) {
  // Le proprietaire de la societe a toujours acces en tant qu ADMIN_SOCIETE
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { ownerId: true },
  });
  if (society?.ownerId === userId) {
    const ownerRole: UserRole = "ADMIN_SOCIETE";
    if (minRole && ROLE_HIERARCHY[ownerRole] < ROLE_HIERARCHY[minRole]) {
      throw new ForbiddenError("Permissions insuffisantes pour cette action");
    }
    return { userId, societyId, role: ownerRole } as { userId: string; societyId: string; role: UserRole };
  }

  const membership = await prisma.userSociety.findUnique({
    where: {
      userId_societyId: { userId, societyId },
    },
  });

  if (!membership) {
    throw new ForbiddenError("Vous n'avez pas acces a cette societe");
  }

  if (minRole && ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
    throw new ForbiddenError("Permissions insuffisantes pour cette action");
  }

  return membership;
}

/**
 * Vérifie qu'un utilisateur est SUPER_ADMIN.
 */
export async function requireSuperAdmin(userId: string) {
  const memberships = await prisma.userSociety.findMany({
    where: { userId },
  });

  const isSuperAdmin = memberships.some(
    (m) => m.role === "SUPER_ADMIN"
  );

  if (!isSuperAdmin) {
    throw new ForbiddenError("Accès réservé aux super administrateurs");
  }

  return true;
}

/**
 * Récupère toutes les sociétés accessibles par un utilisateur.
 */
export async function getUserSocieties(userId: string) {
  const memberships = await prisma.userSociety.findMany({
    where: { userId },
    include: { society: true },
    orderBy: { society: { name: "asc" } },
  });

  return memberships;
}

/**
 * Vérifie si le rôle A est >= au rôle B dans la hiérarchie.
 */
export function hasMinRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Liste des permissions par rôle pour l'affichage UI.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN_SOCIETE: "Administrateur Société",
  GESTIONNAIRE: "Gestionnaire",
  COMPTABLE: "Comptable",
  LECTURE: "Lecture seule",
};
