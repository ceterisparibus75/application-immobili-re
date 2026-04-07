import { z } from "zod";

export const TICKET_TYPES = ["TECHNIQUE", "ADMINISTRATIF"] as const;
export const TICKET_STATUSES = ["OUVERT", "EN_COURS", "EN_ATTENTE", "CLOTURE"] as const;
export const TICKET_PRIORITIES = ["BASSE", "NORMALE", "HAUTE", "URGENTE"] as const;

export const createTicketSchema = z.object({
  title: z.string().min(1, "Le titre est requis").max(255, "Le titre ne doit pas dépasser 255 caractères"),
  description: z.string().min(1, "La description est requise"),
  type: z.enum(TICKET_TYPES, { required_error: "Le type est requis" }),
  priority: z.enum(TICKET_PRIORITIES).optional().default("NORMALE"),
  tenantId: z.string().cuid("Locataire invalide"),
  lotId: z.string().cuid("Lot invalide").optional().nullable(),
  leaseId: z.string().cuid("Bail invalide").optional().nullable(),
  assignedToId: z.string().cuid("Utilisateur invalide").optional().nullable(),
  contractorId: z.string().cuid("Prestataire invalide").optional().nullable(),
});

export const updateTicketSchema = createTicketSchema.partial().extend({
  id: z.string().cuid(),
  status: z.enum(TICKET_STATUSES).optional(),
});

export const addTicketCommentSchema = z.object({
  ticketId: z.string().cuid("Ticket invalide"),
  content: z.string().min(1, "Le commentaire ne peut pas être vide"),
  isInternal: z.boolean().optional().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;
