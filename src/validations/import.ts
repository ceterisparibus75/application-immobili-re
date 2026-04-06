import { z } from "zod";

// ---- Bulk import: Tenants ----
export const importTenantRowSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().min(1, "Le prenom est requis"),
  email: z.string().email("Email invalide"),
  telephone: z.string().optional().default(""),
});

export type ImportTenantRow = z.infer<typeof importTenantRowSchema>;

// ---- Bulk import: Buildings ----
export const importBuildingRowSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  address: z.string().min(5, "L'adresse est requise"),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide (5 chiffres)"),
  city: z.string().min(2, "La ville est requise"),
  type: z
    .enum(["BUREAU", "COMMERCE", "MIXTE", "ENTREPOT"])
    .default("MIXTE"),
});

export type ImportBuildingRow = z.infer<typeof importBuildingRowSchema>;

// ---- Bulk import: Lots ----
export const importLotRowSchema = z.object({
  reference: z.string().min(1, "La reference du lot est requise"),
  type: z
    .enum([
      "LOCAL_COMMERCIAL",
      "BUREAUX",
      "LOCAL_ACTIVITE",
      "RESERVE",
      "PARKING",
      "CAVE",
      "TERRASSE",
      "ENTREPOT",
      "APPARTEMENT",
    ])
    .default("BUREAUX"),
  surface: z.coerce.number().positive("La surface doit etre positive"),
  etage: z.string().optional().default(""),
  buildingId: z.string().min(1, "L'identifiant de l'immeuble est requis"),
});

export type ImportLotRow = z.infer<typeof importLotRowSchema>;

// ---- Entity type union ----
export const importEntityTypeSchema = z.enum(["tenants", "lots", "buildings"]);
export type ImportEntityType = z.infer<typeof importEntityTypeSchema>;
