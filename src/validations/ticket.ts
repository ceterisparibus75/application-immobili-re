import { z } from "zod";

export const TICKET_CATEGORIES = [
  "MAINTENANCE",
  "PLOMBERIE",
  "ELECTRICITE",
  "CHAUFFAGE",
  "NUISANCES",
  "PARTIES_COMMUNES",
  "DOCUMENT",
  "FACTURATION",
  "ASSURANCE",
  "AUTRE",
] as const;

export const TICKET_PRIORITIES = ["BASSE", "NORMALE", "HAUTE", "URGENTE"] as const;
export const TICKET_STATUSES = ["OUVERT", "EN_COURS", "EN_ATTENTE", "RESOLU", "FERME"] as const;

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  PLOMBERIE: "Plomberie",
  ELECTRICITE: "Electricite",
  CHAUFFAGE: "Chauffage",
  NUISANCES: "Nuisances",
  PARTIES_COMMUNES: "Parties communes",
  DOCUMENT: "Demande de document",
  FACTURATION: "Facturation",
  ASSURANCE: "Assurance",
  AUTRE: "Autre",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  EN_ATTENTE: "En attente",
  RESOLU: "Resolu",
  FERME: "Ferme",
};

// Schema pour creation depuis le portail locataire
export const createTicketSchema = z.object({
  subject: z.string().min(1, "Le sujet est requis").max(200),
  description: z.string().min(1, "La description est requise").max(5000),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).default("NORMALE"),
  lotId: z.string().cuid().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

// Schema pour reponse (message)
export const createTicketMessageSchema = z.object({
  ticketId: z.string().cuid(),
  content: z.string().min(1, "Le message est requis").max(5000),
});

// Schema pour mise a jour par le gestionnaire
export const updateTicketSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedToId: z.string().cuid().optional().nullable(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
