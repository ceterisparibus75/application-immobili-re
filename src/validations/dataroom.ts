import { z } from "zod";

export const createDataroomSchema = z.object({
  name: z.string().min(2, "Nom requis (min. 2 caractères)").max(100),
  description: z.string().max(1000, "Description trop longue").optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  password: z.string().max(100).optional().nullable(),
  recipientEmail: z.string().email("Email invalide").optional().nullable(),
  recipientName: z.string().max(100).optional().nullable(),
});

export const updateDataroomSchema = createDataroomSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateDataroomInput = z.infer<typeof createDataroomSchema>;
export type UpdateDataroomInput = z.infer<typeof updateDataroomSchema>;
