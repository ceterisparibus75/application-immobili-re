import { z } from "zod";

export const LEASE_TYPES = [
  // Habitation
  "HABITATION",
  "MEUBLE",
  "ETUDIANT",
  "MOBILITE",
  "COLOCATION",
  "SAISONNIER",
  "LOGEMENT_FONCTION",
  "ANAH",
  "CIVIL",
  "GLISSANT",
  "SOUS_LOCATION",
  // Commercial / Professionnel
  "COMMERCIAL_369",
  "DEROGATOIRE",
  "PRECAIRE",
  "BAIL_PROFESSIONNEL",
  "MIXTE",
  // Baux longs / fonciers
  "EMPHYTEOTIQUE",
  "CONSTRUCTION",
  "REHABILITATION",
  "BRS",
  // Rural
  "RURAL",
  // Types complémentaires
  "AUTORISATION_OCCUPATION_TEMPORAIRE",
  "CONVENTION_OCCUPATION_PRECAIRE",
  "CONVENTION_OCCUPATION_TEMPORAIRE",
  "BAIL_METAYAGE",
  "CONVENTION_COLIVING",
  "CONVENTION_MISE_A_DISPOSITION",
  "BAIL_GLISSANT",
  "BAIL_LOI_48",
  "LOCATION_PARKING",
  "LOCATION_STOCKAGE",
  "DROIT_DE_PASSAGE",
  "AUTRE",
] as const;

export const INDEX_TYPES = ["IRL", "ILC", "ILAT", "ICC"] as const;

export type LeaseType = (typeof LEASE_TYPES)[number];

/** Catégorie de bail pour regrouper les logiques métier */
export type LeaseCategory = "HABITATION" | "COMMERCIAL" | "FONCIER" | "AUTRE";

export function getLeaseCategory(type: LeaseType): LeaseCategory {
  switch (type) {
    case "HABITATION":
    case "MEUBLE":
    case "ETUDIANT":
    case "MOBILITE":
    case "COLOCATION":
    case "SAISONNIER":
    case "LOGEMENT_FONCTION":
    case "ANAH":
    case "CIVIL":
    case "GLISSANT":
    case "SOUS_LOCATION":
    case "MIXTE":
    case "CONVENTION_COLIVING":
    case "BAIL_GLISSANT":
    case "BAIL_LOI_48":
      return "HABITATION";
    case "COMMERCIAL_369":
    case "DEROGATOIRE":
    case "PRECAIRE":
    case "BAIL_PROFESSIONNEL":
    case "RURAL":
    case "BAIL_METAYAGE":
    case "LOCATION_PARKING":
    case "LOCATION_STOCKAGE":
    case "AUTORISATION_OCCUPATION_TEMPORAIRE":
    case "CONVENTION_OCCUPATION_PRECAIRE":
    case "CONVENTION_OCCUPATION_TEMPORAIRE":
    case "CONVENTION_MISE_A_DISPOSITION":
    case "DROIT_DE_PASSAGE":
      return "COMMERCIAL";
    case "EMPHYTEOTIQUE":
    case "CONSTRUCTION":
    case "REHABILITATION":
    case "BRS":
      return "FONCIER";
    case "AUTRE":
    default:
      return "AUTRE";
  }
}

/** Durée par défaut en mois selon le type de bail */
export function getDefaultDuration(type: LeaseType): number {
  switch (type) {
    case "HABITATION": return 36;          // 3 ans (personne physique)
    case "MEUBLE": return 12;              // 1 an
    case "ETUDIANT": return 9;             // 9 mois non renouvelable
    case "MOBILITE": return 10;            // 1-10 mois max
    case "COLOCATION": return 12;          // 1 an meublé / 3 ans vide
    case "SAISONNIER": return 3;           // < 90 jours
    case "LOGEMENT_FONCTION": return 36;   // durée du contrat de travail
    case "ANAH": return 72;               // 6 ans convention
    case "CIVIL": return 12;              // libre (Code civil)
    case "GLISSANT": return 36;           // 3 ans max
    case "SOUS_LOCATION": return 12;      // durée du bail principal
    case "COMMERCIAL_369": return 108;     // 9 ans (3/6/9)
    case "DEROGATOIRE": return 36;         // max 3 ans
    case "PRECAIRE": return 24;            // variable
    case "BAIL_PROFESSIONNEL": return 72;  // 6 ans
    case "MIXTE": return 36;              // 3 ans (partie habitation)
    case "EMPHYTEOTIQUE": return 1188;    // 99 ans max (18 à 99 ans)
    case "CONSTRUCTION": return 840;      // 70 ans max (20 à 99 ans)
    case "REHABILITATION": return 144;    // 12 ans
    case "BRS": return 1068;              // 89 ans max (18 à 99 ans)
    case "RURAL": return 108;             // 9 ans min
    case "AUTORISATION_OCCUPATION_TEMPORAIRE": return 12; // variable, souvent court
    case "CONVENTION_OCCUPATION_PRECAIRE": return 24;     // durée précaire
    case "CONVENTION_OCCUPATION_TEMPORAIRE": return 12;   // temporaire
    case "BAIL_METAYAGE": return 108;                      // 9 ans (rural)
    case "CONVENTION_COLIVING": return 12;                 // 1 an
    case "CONVENTION_MISE_A_DISPOSITION": return 36;       // variable
    case "BAIL_GLISSANT": return 36;                       // 3 ans max
    case "BAIL_LOI_48": return 36;                         // 3 ans renouvelable
    case "LOCATION_PARKING": return 12;                    // libre
    case "LOCATION_STOCKAGE": return 12;                   // libre
    case "DROIT_DE_PASSAGE": return 12;                    // variable
    case "AUTRE": return 12;                               // libre
    default: return 36;
  }
}

/** Index par défaut selon le type de bail */
export function getDefaultIndexType(type: LeaseType): (typeof INDEX_TYPES)[number] | null {
  switch (type) {
    case "HABITATION":
    case "MEUBLE":
    case "ETUDIANT":
    case "MOBILITE":
    case "COLOCATION":
    case "ANAH":
    case "CIVIL":
    case "GLISSANT":
    case "SOUS_LOCATION":
    case "LOGEMENT_FONCTION":
    case "MIXTE":
      return "IRL";
    case "COMMERCIAL_369":
    case "DEROGATOIRE":
      return "ILC";
    case "BAIL_PROFESSIONNEL":
      return "ILAT";
    case "RURAL":
      return "ILC";
    case "EMPHYTEOTIQUE":
    case "CONSTRUCTION":
    case "REHABILITATION":
    case "BRS":
      return "IRL";
    case "AUTORISATION_OCCUPATION_TEMPORAIRE":
    case "CONVENTION_OCCUPATION_PRECAIRE":
    case "CONVENTION_OCCUPATION_TEMPORAIRE":
    case "CONVENTION_MISE_A_DISPOSITION":
    case "LOCATION_PARKING":
    case "LOCATION_STOCKAGE":
    case "DROIT_DE_PASSAGE":
      return null;
    case "BAIL_METAYAGE":
      return "ILC";
    case "CONVENTION_COLIVING":
    case "BAIL_GLISSANT":
    case "BAIL_LOI_48":
      return "IRL";
    default:
      return null;
  }
}

/** TVA applicable par défaut */
export function getDefaultVat(type: LeaseType): { applicable: boolean; rate: number } {
  const category = getLeaseCategory(type);
  if (category === "HABITATION") return { applicable: false, rate: 0 };
  return { applicable: true, rate: 20 };
}

/** Dépôt de garantie max en mois de loyer */
export function getDefaultDepositMonths(type: LeaseType): number {
  switch (type) {
    case "HABITATION": return 1;          // 1 mois max (loi 1989)
    case "MEUBLE": return 2;              // 2 mois max (ALUR)
    case "ETUDIANT": return 2;            // 2 mois max (meublé)
    case "MOBILITE": return 0;            // interdit (ELAN)
    case "COLOCATION": return 2;          // 2 mois meublé, 1 mois vide
    case "SAISONNIER": return 0;          // pas de règle fixe
    case "LOGEMENT_FONCTION": return 1;   // 1 mois (règle habitation)
    case "ANAH": return 1;               // 1 mois
    case "CIVIL": return 0;              // libre
    case "GLISSANT": return 1;           // 1 mois
    case "SOUS_LOCATION": return 1;      // libre
    case "COMMERCIAL_369": return 3;      // usage 3 mois
    case "DEROGATOIRE": return 2;         // libre
    case "PRECAIRE": return 1;            // libre
    case "BAIL_PROFESSIONNEL": return 3;  // libre, usage 3 mois
    case "MIXTE": return 1;              // partie habitation
    case "EMPHYTEOTIQUE": return 0;      // pas de dépôt standard
    case "CONSTRUCTION": return 0;       // pas de dépôt standard
    case "REHABILITATION": return 0;     // pas de dépôt standard
    case "BRS": return 1;               // 1 mois
    case "RURAL": return 0;             // pas d'usage standard
    case "AUTORISATION_OCCUPATION_TEMPORAIRE": return 0;
    case "CONVENTION_OCCUPATION_PRECAIRE": return 1;
    case "CONVENTION_OCCUPATION_TEMPORAIRE": return 0;
    case "BAIL_METAYAGE": return 0;
    case "CONVENTION_COLIVING": return 2;
    case "CONVENTION_MISE_A_DISPOSITION": return 0;
    case "BAIL_GLISSANT": return 1;
    case "BAIL_LOI_48": return 1;
    case "LOCATION_PARKING": return 2;
    case "LOCATION_STOCKAGE": return 2;
    case "DROIT_DE_PASSAGE": return 0;
    case "AUTRE": return 1;
    default: return 1;
  }
}

export const createLeaseSchema = z.object({
  lotId: z.string().cuid(),
  tenantId: z.string().cuid(),
  leaseType: z.enum(LEASE_TYPES),
  startDate: z.string().min(1, "La date de début est requise"),
  durationMonths: z.coerce.number().int().min(1).default(36),
  baseRentHT: z.coerce.number().min(0, "Le loyer doit être positif"),
  depositAmount: z.coerce.number().min(0).default(0),
  paymentFrequency: z
    .enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"])
    .default("MENSUEL"),
  billingTerm: z.enum(["ECHU", "A_ECHOIR"]).default("A_ECHOIR"),
  progressiveRent: z
    .array(
      z.object({
        months: z.coerce.number().int().min(1),
        rentHT: z.coerce.number().min(0),
      })
    )
    .optional()
    .nullable(),
  vatApplicable: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(false),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  indexType: z.enum(INDEX_TYPES).optional().nullable(),
  baseIndexValue: z.coerce.number().optional().nullable(),
  baseIndexQuarter: z.string().optional().nullable(),
  revisionFrequency: z.coerce.number().int().min(1).default(12),
  rentFreeMonths: z.coerce.number().min(0).default(0),
  entryFee: z.coerce.number().min(0).default(0),
  tenantWorksClauses: z.string().optional().nullable(),
});

export const updateLeaseSchema = z.object({
  id: z.string().cuid(),
  leaseType: z.enum(LEASE_TYPES).optional(),
  status: z
    .enum([
      "EN_COURS",
      "RESILIE",
      "RENOUVELE",
      "EN_NEGOCIATION",
      "CONTENTIEUX",
    ])
    .optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  durationMonths: z.coerce.number().int().min(1).optional(),
  baseRentHT: z.coerce.number().min(0).optional(),
  currentRentHT: z.coerce.number().min(0).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  vatApplicable: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  indexType: z.enum(INDEX_TYPES).optional().nullable(),
  baseIndexValue: z.coerce.number().optional().nullable(),
  baseIndexQuarter: z.string().optional().nullable(),
  revisionFrequency: z.coerce.number().int().min(1).optional(),
  billingTerm: z.enum(["ECHU", "A_ECHOIR"]).optional(),
  paymentFrequency: z
    .enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"])
    .optional(),
  tenantWorksClauses: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
  exitDate: z.string().optional().nullable(),
  rentFreeMonths: z.coerce.number().min(0).optional(),
  entryFee: z.coerce.number().min(0).optional(),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
