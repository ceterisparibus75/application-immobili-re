/**
 * Shared RBAC v2 constants and types — safe to import from client components.
 * This file must NOT import Prisma or any server-only modules.
 *
 * Conforme au centre d'aide MyGestia :
 * https://mygestia.immo/aide/utilisateurs
 */

export const MODULES = [
  "patrimoine",
  "baux",
  "locataires",
  "facturation",
  "comptabilite",
  "banque",
  "relances",
  "charges",
  "documents",
  "dashboard",
  "utilisateurs",
  "parametres",
  // Modules internes (non affiches dans le tableau de droits)
  "rapports",
  "rgpd",
  "contacts",
  "administration",
] as const;

export type Module = (typeof MODULES)[number];
export type Permission = "read" | "write" | "delete";
export type ModulePermissions = Record<Module, Permission[]>;

export const MODULE_LABELS: Record<Module, string> = {
  patrimoine: "Patrimoine",
  baux: "Baux",
  locataires: "Locataires",
  facturation: "Facturation",
  comptabilite: "Comptabilite",
  banque: "Banque",
  relances: "Relances",
  charges: "Charges",
  documents: "Documents",
  dashboard: "Dashboard",
  utilisateurs: "Utilisateurs",
  parametres: "Parametres",
  rapports: "Rapports",
  rgpd: "RGPD",
  contacts: "Contacts",
  administration: "Administration",
};

/** Modules visibles dans le tableau de droits UI */
export const DISPLAY_MODULES: Module[] = [
  "patrimoine",
  "baux",
  "locataires",
  "facturation",
  "comptabilite",
  "banque",
  "relances",
  "charges",
  "documents",
  "dashboard",
  "utilisateurs",
  "parametres",
];

const ALL_PERMISSIONS: Permission[] = ["read", "write", "delete"];
const READ_ONLY: Permission[] = ["read"];
const READ_WRITE: Permission[] = ["read", "write"];
const NO_ACCESS: Permission[] = [];

/**
 * Returns the default module permissions for a given role.
 * These defaults apply when UserSociety.modulePermissions is null.
 *
 * Conforme au tableau du centre d'aide :
 * | Module       | Super Admin | Admin | Gestionnaire | Comptable | Lecture |
 * |--------------|-------------|-------|--------------|-----------|---------|
 * | Patrimoine   | LES         | LES   | LE           | L         | L       |
 * | Baux         | LES         | LES   | LE           | L         | L       |
 * | Locataires   | LES         | LES   | LE           | L         | L       |
 * | Facturation  | LES         | LES   | LE           | LE        | L       |
 * | Comptabilite | LES         | LES   | L            | LE        | L       |
 * | Banque       | LES         | LES   | L            | LE        | L       |
 * | Relances     | LES         | LES   | LE           | LE        | L       |
 * | Charges      | LES         | LES   | LE           | L         | L       |
 * | Documents    | LES         | LES   | LE           | L         | L       |
 * | Dashboard    | L           | L     | L            | L         | L       |
 * | Utilisateurs | LES         | LES   | —            | —         | —       |
 * | Parametres   | LES         | LE    | —            | —         | —       |
 */
export function getDefaultPermissions(role: string): ModulePermissions {
  switch (role) {
    case "SUPER_ADMIN":
      return {
        patrimoine: [...ALL_PERMISSIONS],
        baux: [...ALL_PERMISSIONS],
        locataires: [...ALL_PERMISSIONS],
        facturation: [...ALL_PERMISSIONS],
        comptabilite: [...ALL_PERMISSIONS],
        banque: [...ALL_PERMISSIONS],
        relances: [...ALL_PERMISSIONS],
        charges: [...ALL_PERMISSIONS],
        documents: [...ALL_PERMISSIONS],
        dashboard: [...READ_ONLY],
        utilisateurs: [...ALL_PERMISSIONS],
        parametres: [...ALL_PERMISSIONS],
        // Modules internes
        rapports: [...ALL_PERMISSIONS],
        rgpd: [...ALL_PERMISSIONS],
        contacts: [...ALL_PERMISSIONS],
        administration: [...ALL_PERMISSIONS],
      };

    case "ADMIN_SOCIETE":
      return {
        patrimoine: [...ALL_PERMISSIONS],
        baux: [...ALL_PERMISSIONS],
        locataires: [...ALL_PERMISSIONS],
        facturation: [...ALL_PERMISSIONS],
        comptabilite: [...ALL_PERMISSIONS],
        banque: [...ALL_PERMISSIONS],
        relances: [...ALL_PERMISSIONS],
        charges: [...ALL_PERMISSIONS],
        documents: [...ALL_PERMISSIONS],
        dashboard: [...READ_ONLY],
        utilisateurs: [...ALL_PERMISSIONS],
        parametres: [...READ_WRITE],
        // Modules internes
        rapports: [...ALL_PERMISSIONS],
        rgpd: [...ALL_PERMISSIONS],
        contacts: [...ALL_PERMISSIONS],
        administration: [...ALL_PERMISSIONS],
      };

    case "GESTIONNAIRE":
      return {
        patrimoine: [...READ_WRITE],
        baux: [...READ_WRITE],
        locataires: [...READ_WRITE],
        facturation: [...READ_WRITE],
        comptabilite: [...READ_ONLY],
        banque: [...READ_ONLY],
        relances: [...READ_WRITE],
        charges: [...READ_WRITE],
        documents: [...READ_WRITE],
        dashboard: [...READ_ONLY],
        utilisateurs: [...NO_ACCESS],
        parametres: [...NO_ACCESS],
        // Modules internes
        rapports: [...READ_ONLY],
        rgpd: [...READ_ONLY],
        contacts: [...READ_WRITE],
        administration: [...NO_ACCESS],
      };

    case "COMPTABLE":
      return {
        patrimoine: [...READ_ONLY],
        baux: [...READ_ONLY],
        locataires: [...READ_ONLY],
        facturation: [...READ_WRITE],
        comptabilite: [...READ_WRITE],
        banque: [...READ_WRITE],
        relances: [...READ_WRITE],
        charges: [...READ_ONLY],
        documents: [...READ_ONLY],
        dashboard: [...READ_ONLY],
        utilisateurs: [...NO_ACCESS],
        parametres: [...NO_ACCESS],
        // Modules internes
        rapports: [...READ_ONLY],
        rgpd: [...NO_ACCESS],
        contacts: [...READ_ONLY],
        administration: [...NO_ACCESS],
      };

    case "LECTURE":
    default:
      return {
        patrimoine: [...READ_ONLY],
        baux: [...READ_ONLY],
        locataires: [...READ_ONLY],
        facturation: [...READ_ONLY],
        comptabilite: [...READ_ONLY],
        banque: [...READ_ONLY],
        relances: [...READ_ONLY],
        charges: [...READ_ONLY],
        documents: [...READ_ONLY],
        dashboard: [...READ_ONLY],
        utilisateurs: [...NO_ACCESS],
        parametres: [...NO_ACCESS],
        // Modules internes
        rapports: [...READ_ONLY],
        rgpd: [...NO_ACCESS],
        contacts: [...READ_ONLY],
        administration: [...NO_ACCESS],
      };
  }
}
