import { z } from "zod";

export const createMaintenanceSchema = z.object({
  buildingId: z.string().cuid(),
  lotId: z.string().cuid().optional().nullable(),
  title: z.string().min(2, "Le titre est requis").max(200),
  description: z.string().optional(),
  scheduledAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  isPaid: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(false),
  notes: z.string().optional(),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
