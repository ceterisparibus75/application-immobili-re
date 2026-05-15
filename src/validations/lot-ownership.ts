import { z } from "zod";

export const OWNERSHIP_TYPES = ["PLEINE_PROPRIETE", "USUFRUIT", "NUE_PROPRIETE"] as const;

const shareSchema = z
  .number()
  .gt(0, "La quote-part doit être strictement positive")
  .lte(1, "La quote-part ne peut excéder 1 (= 100 %)");

const dateString = z.string().min(1, "La date est requise");

export const createOwnershipSchema = z.object({
  lotId: z.string().cuid(),
  proprietaireId: z.string().cuid(),
  type: z.enum(OWNERSHIP_TYPES),
  share: shareSchema,
  startDate: dateString,
  endDate: z.string().optional().nullable(),
  isViager: z.boolean().optional(),
  usufruitierBirthDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateOwnershipSchema = z.object({
  id: z.string().cuid(),
  proprietaireId: z.string().cuid().optional(),
  type: z.enum(OWNERSHIP_TYPES).optional(),
  share: shareSchema.optional(),
  startDate: dateString.optional(),
  endDate: z.string().optional().nullable(),
  isViager: z.boolean().optional(),
  usufruitierBirthDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const endOwnershipSchema = z.object({
  id: z.string().cuid(),
  endDate: dateString,
  notes: z.string().optional().nullable(),
});

/**
 * Démembrement : on coupe la pleine propriété à `startDate` et on crée
 * une (ou plusieurs) part(s) d'usufruit et de nue-propriété, sommant chacune à 1.
 */
export const splitToUsufructSchema = z
  .object({
    lotId: z.string().cuid(),
    startDate: dateString,
    usufruit: z
      .array(
        z.object({
          proprietaireId: z.string().cuid(),
          share: shareSchema,
          isViager: z.boolean().optional(),
          usufruitierBirthDate: z.string().optional().nullable(),
          endDate: z.string().optional().nullable(),
        }),
      )
      .min(1, "Au moins un usufruitier est requis"),
    nuePropriete: z
      .array(
        z.object({
          proprietaireId: z.string().cuid(),
          share: shareSchema,
        }),
      )
      .min(1, "Au moins un nu-propriétaire est requis"),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) => approxEqual(data.usufruit.reduce((s, u) => s + u.share, 0), 1),
    { message: "La somme des quote-parts d'usufruit doit être égale à 1", path: ["usufruit"] },
  )
  .refine(
    (data) => approxEqual(data.nuePropriete.reduce((s, n) => s + n.share, 0), 1),
    { message: "La somme des quote-parts de nue-propriété doit être égale à 1", path: ["nuePropriete"] },
  );

function approxEqual(a: number, b: number, tol = 0.001): boolean {
  return Math.abs(a - b) <= tol;
}

export type CreateOwnershipInput = z.infer<typeof createOwnershipSchema>;
export type UpdateOwnershipInput = z.infer<typeof updateOwnershipSchema>;
export type EndOwnershipInput = z.infer<typeof endOwnershipSchema>;
export type SplitToUsufructInput = z.infer<typeof splitToUsufructSchema>;
