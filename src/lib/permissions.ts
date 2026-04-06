import { UserRole } from "@/generated/prisma/client";
import { prisma } from "./prisma";

// Re-export shared constants/types (safe for client components)
export {
  MODULES,
  MODULE_LABELS,
  getDefaultPermissions,
  type Module,
  type Permission,
  type ModulePermissions,
} from "./permissions-shared";

import type { Module, Permission, ModulePermissions } from "./permissions-shared";
import { MODULES, MODULE_LABELS, getDefaultPermissions } from "./permissions-shared";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 50,
  ADMIN_SOCIETE: 40,
  GESTIONNAIRE: 30,
  COMPTABLE: 20,
  LECTURE: 10,
};

/**
 * Resolves effective module permissions for a UserSociety membership.
 * If modulePermissions JSON is set, use it; otherwise derive from role.
 */
function resolveModulePermissions(
  role: UserRole,
  modulePermissionsJson: unknown
): ModulePermissions {
  if (
    modulePermissionsJson &&
    typeof modulePermissionsJson === "object" &&
    !Array.isArray(modulePermissionsJson)
  ) {
    return modulePermissionsJson as ModulePermissions;
  }
  return getDefaultPermissions(role);
}

/**
 * Checks whether a user has a specific permission on a specific module
 * within a society. Owners always have full access.
 */
export async function hasModulePermission(
  userId: string,
  societyId: string,
  module: Module,
  permission: Permission
): Promise<boolean> {
  // Owners always have full access
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { ownerId: true, proprietaire: { select: { userId: true } } },
  });
  if (society?.ownerId === userId || society?.proprietaire?.userId === userId) {
    return true;
  }

  const membership = await prisma.userSociety.findUnique({
    where: { userId_societyId: { userId, societyId } },
  });

  if (!membership) return false;

  const perms = resolveModulePermissions(
    membership.role,
    membership.modulePermissions
  );

  const modulePerms = perms[module];
  if (!modulePerms) return false;

  return modulePerms.includes(permission);
}

/**
 * Requires a specific module permission. Throws ForbiddenError if denied.
 */
export async function requireModulePermission(
  userId: string,
  societyId: string,
  module: Module,
  permission: Permission
): Promise<void> {
  const allowed = await hasModulePermission(userId, societyId, module, permission);
  if (!allowed) {
    throw new ForbiddenError(
      `Accès refusé : permission "${permission}" requise sur le module "${MODULE_LABELS[module]}"`
    );
  }
}

/**
 * Gets the effective permissions for a user in a society.
 * Returns null if user has no membership (and is not owner).
 */
export async function getEffectivePermissions(
  userId: string,
  societyId: string
): Promise<{ role: UserRole; permissions: ModulePermissions } | null> {
  // Check owner
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { ownerId: true, proprietaire: { select: { userId: true } } },
  });
  if (society?.ownerId === userId || society?.proprietaire?.userId === userId) {
    return { role: "ADMIN_SOCIETE", permissions: getDefaultPermissions("ADMIN_SOCIETE") };
  }

  const membership = await prisma.userSociety.findUnique({
    where: { userId_societyId: { userId, societyId } },
  });
  if (!membership) return null;

  const perms = resolveModulePermissions(
    membership.role,
    membership.modulePermissions
  );

  return { role: membership.role, permissions: perms };
}

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
  // Vérifie ownerId direct OU via Proprietaire entity
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { ownerId: true, proprietaire: { select: { userId: true } } },
  });
  if (society?.ownerId === userId || society?.proprietaire?.userId === userId) {
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
