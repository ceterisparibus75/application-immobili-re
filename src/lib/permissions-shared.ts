/**
 * Shared RBAC v2 constants and types — safe to import from client components.
 * This file must NOT import Prisma or any server-only modules.
 */

export const MODULES = [
  "patrimoine",
  "baux",
  "locataires",
  "facturation",
  "comptabilite",
  "banque",
  "relances",
  "rapports",
  "rgpd",
  "administration",
  "contacts",
  "documents",
] as const;

export type Module = (typeof MODULES)[number];
export type Permission = "read" | "write" | "delete";
export type ModulePermissions = Record<Module, Permission[]>;

export const MODULE_LABELS: Record<Module, string> = {
  patrimoine: "Patrimoine",
  baux: "Baux",
  locataires: "Locataires",
  facturation: "Facturation",
  comptabilite: "Comptabilité",
  banque: "Banque",
  relances: "Relances",
  rapports: "Rapports",
  rgpd: "RGPD",
  administration: "Administration",
  contacts: "Contacts",
  documents: "Documents",
};

const ALL_PERMISSIONS: Permission[] = ["read", "write", "delete"];
const READ_ONLY: Permission[] = ["read"];
const READ_WRITE: Permission[] = ["read", "write"];

function allModules(perms: Permission[]): ModulePermissions {
  return Object.fromEntries(MODULES.map((m) => [m, [...perms]])) as ModulePermissions;
}

/**
 * Returns the default module permissions for a given role.
 * These defaults apply when UserSociety.modulePermissions is null.
 */
export function getDefaultPermissions(role: string): ModulePermissions {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN_SOCIETE":
      return allModules(ALL_PERMISSIONS);

    case "GESTIONNAIRE": {
      const perms = allModules(READ_WRITE);
      perms.administration = READ_ONLY;
      perms.rgpd = READ_ONLY;
      return perms;
    }

    case "COMPTABLE": {
      const perms = allModules(READ_ONLY);
      perms.facturation = [...READ_WRITE];
      perms.comptabilite = [...READ_WRITE];
      perms.banque = [...READ_WRITE];
      perms.relances = [...READ_WRITE];
      perms.administration = [];
      return perms;
    }

    case "LECTURE":
    default: {
      const perms = allModules(READ_ONLY);
      perms.administration = [];
      perms.rgpd = [];
      return perms;
    }
  }
}
