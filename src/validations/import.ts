import { z } from "zod";

// ---- Bulk import: Tenants ----
function normalizeTenantEntityType(value: string): "PERSONNE_PHYSIQUE" | "PERSONNE_MORALE" | null {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (!normalized) return null;
  if ([
    "personnemorale",
    "morale",
    "societe",
    "society",
    "company",
    "entreprise",
    "pro",
    "professionnel",
    "sci",
    "sas",
    "sasu",
    "sarl",
    "eurl",
    "sa",
    "snc",
  ].includes(normalized)) {
    return "PERSONNE_MORALE";
  }
  if (["personnephysique", "physique", "particulier", "individual", "personne"].includes(normalized)) {
    return "PERSONNE_PHYSIQUE";
  }
  if (normalized === "personnemoral") return "PERSONNE_MORALE";
  return null;
}

export const importTenantRowSchema = z
  .object({
    nom: z.string().optional().default(""),
    prenom: z.string().optional().default(""),
    email: z.string().email("Email invalide"),
    telephone: z.string().optional().default(""),
    entityType: z.string().optional().default(""),
    companyName: z.string().optional().default(""),
    companyLegalForm: z.string().optional().default(""),
    siret: z.string().optional().default(""),
  })
  .transform((data) => {
    const entityType = normalizeTenantEntityType(data.entityType) ?? (data.companyName.trim() ? "PERSONNE_MORALE" : "PERSONNE_PHYSIQUE");
    return {
      ...data,
      entityType,
      companyName: entityType === "PERSONNE_MORALE" && !data.companyName.trim() && data.nom.trim()
        ? data.nom
        : data.companyName,
    };
  })
  .superRefine((data, ctx) => {
    if (data.entityType === "PERSONNE_MORALE") {
      if (!data.companyName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companyName"],
          message: "La raison sociale est requise",
        });
      }
      return;
    }

    if (!data.nom.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nom"], message: "Le nom est requis" });
    }
    if (!data.prenom.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["prenom"], message: "Le prenom est requis" });
    }
  });

export type ImportTenantRow = z.infer<typeof importTenantRowSchema>;

function normalizeContactType(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const mapping: Record<string, string> = {
    locataire: "LOCATAIRE",
    prestataire: "PRESTATAIRE",
    fournisseur: "PRESTATAIRE",
    artisan: "PRESTATAIRE",
    notaire: "NOTAIRE",
    expert: "EXPERT",
    syndic: "SYNDIC",
    agence: "AGENCE",
    agent: "AGENCE",
    autre: "AUTRE",
  };

  return mapping[normalized] ?? (value || "PRESTATAIRE");
}

// ---- Bulk import: Contacts ----
export const importContactRowSchema = z.object({
  contactType: z
    .string()
    .optional()
    .default("")
    .transform((value) => normalizeContactType(value || "PRESTATAIRE"))
    .pipe(z.enum(["LOCATAIRE", "PRESTATAIRE", "NOTAIRE", "EXPERT", "SYNDIC", "AGENCE", "AUTRE"])),
  name: z.string().min(1, "Le nom est requis"),
  company: z.string().optional().default(""),
  specialty: z.string().optional().default(""),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")).default(""),
  phone: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  city: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type ImportContactRow = z.infer<typeof importContactRowSchema>;

// ---- Bulk import: Buildings ----
function normalizeBuildingType(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const mapping: Record<string, string> = {
    bureau: "BUREAU",
    bureaux: "BUREAU",
    tertiaire: "BUREAU",
    commerce: "COMMERCE",
    commercial: "COMMERCE",
    localcommercial: "COMMERCE",
    boutique: "COMMERCE",
    mixte: "MIXTE",
    entrepot: "ENTREPOT",
    stockage: "ENTREPOT",
    logistique: "ENTREPOT",
  };

  return mapping[normalized] ?? (value || "MIXTE");
}

export const importBuildingRowSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  address: z.string().min(5, "L'adresse est requise"),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide (5 chiffres)"),
  city: z.string().min(2, "La ville est requise"),
  type: z
    .string()
    .optional()
    .default("MIXTE"),
}).transform((data) => ({ ...data, type: normalizeBuildingType(data.type) }))
  .pipe(z.object({
    name: z.string(),
    address: z.string(),
    postalCode: z.string(),
    city: z.string(),
    type: z.enum(["BUREAU", "COMMERCE", "MIXTE", "ENTREPOT"]),
  }));

export type ImportBuildingRow = z.infer<typeof importBuildingRowSchema>;

// ---- Bulk import: Lots ----
function normalizeLotType(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const mapping: Record<string, string> = {
    localcommercial: "LOCAL_COMMERCIAL",
    commerce: "LOCAL_COMMERCIAL",
    boutique: "LOCAL_COMMERCIAL",
    bureaux: "BUREAUX",
    bureau: "BUREAUX",
    localactivite: "LOCAL_ACTIVITE",
    localdactivite: "LOCAL_ACTIVITE",
    activite: "LOCAL_ACTIVITE",
    atelier: "LOCAL_ACTIVITE",
    reserve: "RESERVE",
    parking: "PARKING",
    cave: "CAVE",
    terrasse: "TERRASSE",
    entrepot: "ENTREPOT",
    stockage: "ENTREPOT",
    appartement: "APPARTEMENT",
    logement: "APPARTEMENT",
  };

  return mapping[normalized] ?? (value || "BUREAUX");
}

export const importLotRowSchema = z
  .object({
    reference: z.string().min(1, "La reference du lot est requise"),
    type: z
      .string()
      .optional()
      .default("BUREAUX"),
    surface: z.coerce.number().positive("La surface doit etre positive"),
    etage: z.string().optional().default(""),
    buildingId: z.string().optional().default(""),
    buildingName: z.string().optional().default(""),
  })
  .transform((data) => ({ ...data, type: normalizeLotType(data.type) }))
  .pipe(z.object({
    reference: z.string(),
    type: z.enum([
      "LOCAL_COMMERCIAL",
      "BUREAUX",
      "LOCAL_ACTIVITE",
      "RESERVE",
      "PARKING",
      "CAVE",
      "TERRASSE",
      "ENTREPOT",
      "APPARTEMENT",
    ]),
    surface: z.number(),
    etage: z.string(),
    buildingId: z.string(),
    buildingName: z.string(),
  }))
  .superRefine((data, ctx) => {
    if (!data.buildingId.trim() && !data.buildingName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buildingId"],
        message: "L'identifiant ou le nom de l'immeuble est requis",
      });
    }
  });

export type ImportLotRow = z.infer<typeof importLotRowSchema>;

// ---- Entity type union ----
export const importEntityTypeSchema = z.enum(["tenants", "lots", "buildings", "contacts"]);
export type ImportEntityType = z.infer<typeof importEntityTypeSchema>;
