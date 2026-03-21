import { z } from "zod";

export const createContactSchema = z.object({
  contactType: z.enum([
    "LOCATAIRE",
    "PRESTATAIRE",
    "NOTAIRE",
    "EXPERT",
    "SYNDIC",
    "AGENCE",
    "AUTRE",
  ]),
  name: z.string().min(1, "Le nom est requis"),
  company: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateContactSchema = createContactSchema
  .partial()
  .extend({ id: z.string().cuid() });

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
