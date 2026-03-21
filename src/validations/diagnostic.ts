import { z } from "zod";

export const createDiagnosticSchema = z.object({
  buildingId: z.string().cuid(),
  type: z.string().min(1, "Le type de diagnostic est requis"),
  performedAt: z.string().min(1, "La date de réalisation est requise"),
  expiresAt: z.string().optional().nullable(),
  result: z.string().optional(),
  fileUrl: z.string().url("URL invalide").optional().nullable(),
});

export const updateDiagnosticSchema = createDiagnosticSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateDiagnosticInput = z.infer<typeof createDiagnosticSchema>;
export type UpdateDiagnosticInput = z.infer<typeof updateDiagnosticSchema>;
