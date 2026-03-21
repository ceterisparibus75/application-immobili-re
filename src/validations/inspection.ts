import { z } from "zod";

const inspectionRoomSchema = z.object({
  name: z.string().min(1, "Le nom de la pièce est requis"),
  condition: z.enum(["BON", "USAGE_NORMAL", "DEGRADE", "TRES_DEGRADE"]),
  notes: z.string().optional().nullable(),
});

export const createInspectionSchema = z.object({
  leaseId: z.string().cuid(),
  type: z.enum(["ENTREE", "SORTIE"]),
  performedAt: z.string().min(1, "La date est requise"),
  performedBy: z.string().optional().nullable(),
  generalNotes: z.string().optional().nullable(),
  rooms: z.array(inspectionRoomSchema).default([]),
});

export const updateInspectionSchema = z.object({
  id: z.string().cuid(),
  performedBy: z.string().optional().nullable(),
  generalNotes: z.string().optional().nullable(),
  signedFileUrl: z.string().url().optional().nullable(),
});

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
