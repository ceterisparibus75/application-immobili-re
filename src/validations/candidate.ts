import { z } from "zod";

export const createCandidateSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  company: z.string().max(200).optional(),
  pipelineId: z.string().cuid().optional(),
  lotId: z.string().cuid().optional(),
  stageId: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  source: z.string().max(50).optional(),
  monthlyIncome: z.number().positive().optional(),
  guarantorName: z.string().max(200).optional(),
  desiredMoveIn: z.string().optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial().extend({
  id: z.string().cuid(),
  status: z.enum([
    "NEW", "CONTACTED", "VISIT_SCHEDULED", "VISIT_DONE",
    "DOSSIER_RECEIVED", "DOSSIER_VALIDATED", "ACCEPTED", "REJECTED", "WITHDRAWN",
  ]).optional(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;

export const createPipelineSchema = z.object({
  name: z.string().min(1, "Nom requis").max(100),
  stages: z.array(z.object({
    id: z.string(),
    name: z.string().min(1),
    order: z.number().int(),
    color: z.string().optional(),
  })).min(1, "Au moins une étape requise"),
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;

export const addActivitySchema = z.object({
  candidateId: z.string().cuid(),
  type: z.enum(["NOTE", "EMAIL_SENT", "CALL", "VISIT", "DOCUMENT_RECEIVED", "STATUS_CHANGE", "SCORE_UPDATE"]),
  content: z.string().max(5000).optional(),
});

export type AddActivityInput = z.infer<typeof addActivitySchema>;
