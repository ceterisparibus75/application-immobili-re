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
  marketRentValue: z.coerce.number().min(0).optional().nullable(),
  currentRent: z.coerce.number().min(0).optional().nullable(),
});

export const updateLotSchema = createLotSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
