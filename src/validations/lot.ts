import { z } from "zod";

export const createLotSchema = z.object({
  buildingId: z.string().cuid(),
  number: z.string().min(1, "Le numero de lot est requis").max(50),
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
  area: z.coerce.number().positive("La surface doit etre positive"),
  commonShares: z.coerce.number().int().min(0).optional().nullable(),
  floor: z.string().optional(),
  position: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["OCCUPE", "VACANT", "EN_TRAVAUX", "RESERVE"]).default("VACANT"),
  fiscalRegime: z.enum(["MICRO_FONCIER", "REEL_FONCIER", "LMNP_MICRO_BIC", "LMNP_REEL", "LMP", "MEUBLE_TOURISME"]).optional().or(z.literal("")),
  marketRentValue: z.coerce.number().min(0).optional().nullable(),
  currentRent: z.coerce.number().min(0).optional().nullable(),
});

export const updateLotSchema = createLotSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
