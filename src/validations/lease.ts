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
] as const;

export const LEASE_DESTINATIONS = [
  "HABITATION",
  "BUREAU",
  "COMMERCE",
  "ACTIVITE",
  "ENTREPOT",
  "INDUSTRIEL",
  "PROFESSIONNEL",
  "MIXTE",
  "PARKING",
  "TERRAIN",
  "AGRICOLE",
  "HOTELLERIE",
  "EQUIPEMENT",
  "AUTRE",
] as const;

export const INDEX_TYPES = ["IRL", "ILC", "ILAT", "ICC"] as const;
export const REVISION_DATE_BASIS = ["DATE_SIGNATURE", "DATE_ENTREE", "PREMIER_JANVIER", "DATE_PERSONNALISEE"] as const;

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
      return "HABITATION";
    case "COMMERCIAL_369":
    case "DEROGATOIRE":
    case "PRECAIRE":
    case "BAIL_PROFESSIONNEL":
    case "RURAL":
      return "COMMERCIAL";
    case "EMPHYTEOTIQUE":
    case "CONSTRUCTION":
    case "REHABILITATION":
    case "BRS":
      return "FONCIER";
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
    default: return 1;
  }
}

export const createLeaseSchema = z.object({
  lotIds: z.array(z.string().cuid()).min(1, "Sélectionnez au moins un lot"),
  tenantId: z.string().cuid(),
  leaseType: z.enum(LEASE_TYPES),
  destination: z.enum(LEASE_DESTINATIONS).optional().nullable(),
  leaseTemplateId: z.string().cuid().optional().nullable(),
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
  revisionDateBasis: z.enum(REVISION_DATE_BASIS).default("DATE_SIGNATURE").optional().nullable(),
  revisionCustomMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  revisionCustomDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  rentFreeMonths: z.coerce.number().min(0).default(0),
  entryFee: z.coerce.number().min(0).default(0),
  tenantWorksClauses: z.string().optional().nullable(),
  isThirdPartyManaged: z.boolean().default(false),
  managingContactId: z.string().cuid().optional().nullable(),
  managementFeeType: z.enum(["POURCENTAGE", "FORFAIT"]).optional().nullable(),
  managementFeeValue: z.coerce.number().min(0).optional().nullable(),
  managementFeeBasis: z.enum(["LOYER_HT", "LOYER_CHARGES_HT", "TOTAL_TTC"]).optional().nullable(),
  managementFeeVatRate: z.coerce.number().min(0).max(100).default(20).optional().nullable(),
});

export const updateLeaseSchema = z.object({
  id: z.string().cuid(),
  leaseType: z.enum(LEASE_TYPES).optional(),
  destination: z.enum(LEASE_DESTINATIONS).optional().nullable(),
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
  revisionDateBasis: z.enum(REVISION_DATE_BASIS).optional().nullable(),
  revisionCustomMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  revisionCustomDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  billingTerm: z.enum(["ECHU", "A_ECHOIR"]).optional(),
  paymentFrequency: z
    .enum(["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"])
    .optional(),
  tenantWorksClauses: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
  exitDate: z.string().optional().nullable(),
  rentFreeMonths: z.coerce.number().min(0).optional(),
  entryFee: z.coerce.number().min(0).optional(),
  isThirdPartyManaged: z.boolean().default(false).optional(),
  managingContactId: z.string().cuid().optional().nullable(),
  managementFeeType: z.enum(["POURCENTAGE", "FORFAIT"]).optional().nullable(),
  managementFeeValue: z.coerce.number().min(0).optional().nullable(),
  managementFeeBasis: z.enum(["LOYER_HT", "LOYER_CHARGES_HT", "TOTAL_TTC"]).optional().nullable(),
  managementFeeVatRate: z.coerce.number().min(0).max(100).default(20).optional().nullable(),
});

// --- Paliers de loyer ---
export const rentStepSchema = z.object({
  label: z.string().min(1, "Le libellé est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().optional().nullable(),
  rentHT: z.coerce.number().min(0, "Le loyer doit être positif"),
  chargesHT: z.coerce.number().min(0).optional().nullable(),
});

export const createRentStepsSchema = z.object({
  leaseId: z.string().cuid(),
  steps: z.array(rentStepSchema).min(1, "Au moins un palier est requis"),
}).superRefine((data, ctx) => {
  const sorted = [...data.steps].sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];
    const start = new Date(step.startDate);
    const end = step.endDate ? new Date(step.endDate) : null;

    // Date de fin doit être après la date de début
    if (end && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Palier "${step.label}" : la date de fin doit être postérieure à la date de début`,
      });
    }

    // Vérifier les chevauchements avec le palier suivant
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const nextStart = new Date(next.startDate);

      if (end && end >= nextStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Les paliers "${step.label}" et "${next.label}" se chevauchent`,
        });
      }
    }

    // Le dernier palier doit avoir une date de fin (sauf si c'est le seul)
    if (sorted.length > 1 && i < sorted.length - 1 && !end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le palier "${step.label}" doit avoir une date de fin car un palier suivant existe`,
      });
    }
  }
});

export const updateRentStepSchema = rentStepSchema.extend({
  id: z.string().cuid(),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type RentStepInput = z.infer<typeof rentStepSchema>;
export type CreateRentStepsInput = z.infer<typeof createRentStepsSchema>;
