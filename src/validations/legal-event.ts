import { z } from "zod";

export const LEGAL_EVENT_TYPES = [
  "CESSION",
  "CONGE",
  "EVICTION",
  "COMMANDEMENT_PAYER",
  "ACTE_HUISSIER",
  "RENOUVELLEMENT_CONTESTE",
  "SOUS_LOCATION",
  "DESPECIALISATION",
  "MISE_EN_DEMEURE",
  "AUTRE",
] as const;

export const LEGAL_EVENT_STATUSES = ["OUVERT", "EN_COURS", "RESOLU", "CLASSE"] as const;

export const createLegalEventSchema = z.object({
  leaseId: z.string().cuid("ID bail invalide"),
  type: z.enum(LEGAL_EVENT_TYPES, { message: "Type d'événement invalide" }),
  title: z.string().min(1, "Le titre est requis").max(255, "Titre trop long"),
  description: z.string().max(5000, "Description trop longue").optional().nullable(),
  eventDate: z.string().min(1, "La date est requise"),
  dueDate: z.string().optional().nullable(),
  status: z.enum(LEGAL_EVENT_STATUSES).optional().default("OUVERT"),
});

export const updateLegalEventSchema = z.object({
  id: z.string().cuid("ID invalide"),
  type: z.enum(LEGAL_EVENT_TYPES, { message: "Type d'événement invalide" }).optional(),
  title: z.string().min(1, "Le titre est requis").max(255, "Titre trop long").optional(),
  description: z.string().max(5000, "Description trop longue").optional().nullable(),
  eventDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  status: z.enum(LEGAL_EVENT_STATUSES).optional(),
  resolvedNote: z.string().max(2000, "Note trop longue").optional().nullable(),
});

export type CreateLegalEventInput = z.input<typeof createLegalEventSchema>;
export type UpdateLegalEventInput = z.input<typeof updateLegalEventSchema>;
