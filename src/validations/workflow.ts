import { z } from "zod";

const triggerSchema = z.object({
  type: z.enum(["event", "schedule", "manual"]),
  config: z.record(z.unknown()),
});

const stepSchema = z.object({
  id: z.string(),
  type: z.enum([
    "send_email", "send_notification", "update_status", "create_task",
    "delay", "condition", "webhook", "generate_pdf", "send_reminder",
  ]),
  config: z.record(z.unknown()),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  connections: z.array(z.string()).optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  description: z.string().max(2000).optional(),
  trigger: triggerSchema,
  steps: z.array(stepSchema).min(1, "Au moins une étape requise"),
  isActive: z.boolean().default(false),
});

export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  id: z.string().cuid(),
});

export type WorkflowTrigger = z.infer<typeof triggerSchema>;
export type WorkflowStep = z.infer<typeof stepSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
