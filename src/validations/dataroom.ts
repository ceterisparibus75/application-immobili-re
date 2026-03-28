import { z } from "zod";

export const createDataroomSchema = z.object({
  name: z.string().min(2, "Nom requis (min. 2 caractères)").max(100),
  description: z.string().max(1000, "Description trop longue").optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

export const updateDataroomSchema = createDataroomSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateDataroomInput = z.infer<typeof createDataroomSchema>;
export type UpdateDataroomInput = z.infer<typeof updateDataroomSchema>;
