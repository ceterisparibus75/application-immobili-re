import { z } from "zod";

export const LEASE_TYPES = [
  "HABITATION",
  "MEUBLE",
  "MOBILITE",
  "SAISONNIER",
  "ANAH",
  "COMMERCIAL_369",
  "DEROGATOIRE",
  "PRECAIRE",
  "BAIL_PROFESSIONNEL",
  "MIXTE",
  "RURAL",
] as const;

export const INDEX_TYPES = ["IRL", "ILC", "ILAT", "ICC"] as const;

export type LeaseType = (typeof LEASE_TYPES)[number];

/** Catégorie de bail pour regrouper les logiques métier */
export type LeaseCategory = "HABITATION" | "COMMERCIAL" | "AUTRE";

export function getLeaseCategory(type: LeaseType): LeaseCategory {
  switch (type) {
    case "HABITATION":
    case "MEUBLE":
    case "MOBILITE":
    case "SAISONNIER":
    case "ANAH":
    case "MIXTE":
      return "HABITATION";
    case "COMMERCIAL_369":
    case "DEROGATOIRE":
    case "PRECAIRE":
    case "BAIL_PROFESSIONNEL":
    case "RURAL":
      return "COMMERCIAL";
    default:
      return "AUTRE";
  }
}

/** Durée par défaut en mois selon le type de bail */
export function getDefaultDuration(type: LeaseType): number {
  switch (type) {
    case "HABITATION": return 36;        // 3 ans (personne physique)
    case "MEUBLE": return 12;            // 1 an
    case "MOBILITE": return 10;          // 1-10 mois max
    case "SAISONNIER": return 3;         // < 90 jours
    case "ANAH": return 72;              // 6 ans convention
    case "COMMERCIAL_369": return 108;   // 9 ans (3/6/9)
    case "DEROGATOIRE": return 36;       // max 3 ans
    case "PRECAIRE": return 24;          // variable
    case "BAIL_PROFESSIONNEL": return 72; // 6 ans
    case "MIXTE": return 36;             // 3 ans (partie habitation)
    case "RURAL": return 108;            // 9 ans min
    default: return 36;
  }
}

/** Index par défaut selon le type de bail */
export function getDefaultIndexType(type: LeaseType): (typeof INDEX_TYPES)[number] | null {
  switch (type) {
    case "HABITATION":
    case "MEUBLE":
    case "MOBILITE":
    case "ANAH":
    case "MIXTE":
      return "IRL";
    case "COMMERCIAL_369":
    case "DEROGATOIRE":
      return "ILC";
    case "BAIL_PROFESSIONNEL":
      return "ILAT";
    case "RURAL":
      return "ILC";
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
    case "HABITATION": return 1;     // 1 mois max (loi 1989)
    case "MEUBLE": return 2;         // 2 mois max (ALUR)
    case "MOBILITE": return 0;       // interdit (ELAN)
    case "SAISONNIER": return 0;     // pas de règle fixe
    case "ANAH": return 1;           // 1 mois
    case "COMMERCIAL_369": return 3; // usage 3 mois
    case "DEROGATOIRE": return 2;    // libre
    case "PRECAIRE": return 1;       // libre
    case "BAIL_PROFESSIONNEL": return 3; // libre, usage 3 mois
    case "MIXTE": return 1;          // partie habitation
    case "RURAL": return 0;          // pas d'usage standard
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
  status: z
    .enum([
      "EN_COURS",
      "RESILIE",
      "RENOUVELE",
      "EN_NEGOCIATION",
      "CONTENTIEUX",
    ])
    .optional(),
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
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
