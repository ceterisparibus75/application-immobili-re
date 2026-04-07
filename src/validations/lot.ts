import { z } from "zod";

export const createLotSchema = z.object({
  buildingId: z.string().cuid(),
  number: z.string().min(1, "Le numéro de lot est requis").max(50),
  lotType: z.enum([
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
  area: z.coerce.number().positive("La surface doit être positive"),
  commonShares: z.coerce.number().int().min(0).optional().nullable(),
  floor: z.string().optional(),
  position: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["OCCUPE", "VACANT", "EN_TRAVAUX", "RESERVE"]).default("VACANT"),
  exploitationStatus: z.enum([
    "EE_EN_EXPLOITATION", "EE_MISE_HE_PREVUE", "EE_EN_VENTE",
    "HE_EN_ACQUISITION", "HE_EN_CONSTRUCTION", "HE_EN_RENOVATION",
    "HE_EN_TRAVAUX", "HE_PERMIS_EN_ATTENTE", "HE_EN_LIVRAISON",
    "HE_MISE_EE_PREVUE", "HE_AUTRE",
    "FE_VENDU", "FE_DETRUIT", "FE_AUTRE",
    "INCONNU",
  ]).optional().default("INCONNU"),
  marketRentValue: z.coerce.number().min(0).optional().nullable(),
  currentRent: z.coerce.number().min(0).optional().nullable(),
});

export const updateLotSchema = createLotSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
