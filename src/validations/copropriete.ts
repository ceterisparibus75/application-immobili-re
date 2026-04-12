import { z } from "zod";

/* ─── Copropriété ───────────────────────────────────────────────────── */

export const createCoproprieteSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  address: z.string().min(1, "Adresse requise").max(300),
  city: z.string().min(1, "Ville requise").max(100),
  postalCode: z.string().min(5, "Code postal requis").max(10),
  totalTantiemes: z.number().int().min(1, "Tantièmes requis"),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
  siret: z.string().max(14).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateCoproprieteSchema = createCoproprieteSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateCoproprieteInput = z.infer<typeof createCoproprieteSchema>;
export type UpdateCoproprieteInput = z.infer<typeof updateCoproprieteSchema>;

/* ─── Lot copropriété ───────────────────────────────────────────────── */

export const createCoproLotSchema = z.object({
  coproprieteId: z.string().cuid(),
  lotNumber: z.string().min(1, "Numéro de lot requis").max(20),
  ownerName: z.string().min(1, "Nom du copropriétaire requis").max(200),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  tantiemes: z.number().int().min(1, "Tantièmes requis"),
  description: z.string().max(300).optional(),
  floor: z.string().max(10).optional(),
  area: z.number().positive().optional(),
});

export const updateCoproLotSchema = createCoproLotSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateCoproLotInput = z.infer<typeof createCoproLotSchema>;
export type UpdateCoproLotInput = z.infer<typeof updateCoproLotSchema>;

/* ─── Budget prévisionnel ───────────────────────────────────────────── */

export const budgetLineSchema = z.object({
  category: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().min(0),
  description: z.string().optional(),
});

export const createCoproBudgetSchema = z.object({
  coproprieteId: z.string().cuid(),
  year: z.number().int().min(2020).max(2050),
  totalAmount: z.number().min(0),
  lines: z.array(budgetLineSchema).min(1, "Au moins une ligne de budget"),
  notes: z.string().max(5000).optional(),
});

export const updateCoproBudgetSchema = createCoproBudgetSchema.partial().extend({
  id: z.string().cuid(),
});

export type BudgetLine = z.infer<typeof budgetLineSchema>;
export type CreateCoproBudgetInput = z.infer<typeof createCoproBudgetSchema>;
export type UpdateCoproBudgetInput = z.infer<typeof updateCoproBudgetSchema>;

/* ─── Assemblée Générale ────────────────────────────────────────────── */

export const createAssemblySchema = z.object({
  coproprieteId: z.string().cuid(),
  title: z.string().min(1, "Titre requis").max(300),
  date: z.string().datetime().or(z.string().min(1)),
  type: z.enum(["ORDINAIRE", "EXTRAORDINAIRE", "MIXTE"]).default("ORDINAIRE"),
  location: z.string().max(500).optional(),
  isOnline: z.boolean().default(false),
  quorumRequired: z.number().min(0).max(1).default(0.5),
  notes: z.string().max(5000).optional(),
});

export const updateAssemblySchema = createAssemblySchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateAssemblyInput = z.infer<typeof createAssemblySchema>;
export type UpdateAssemblyInput = z.infer<typeof updateAssemblySchema>;

/* ─── Résolution ────────────────────────────────────────────────────── */

export const createResolutionSchema = z.object({
  assemblyId: z.string().cuid(),
  number: z.number().int().min(1),
  title: z.string().min(1, "Titre requis").max(500),
  description: z.string().max(5000).optional(),
  majority: z.enum(["SIMPLE", "ABSOLUE", "DOUBLE", "UNANIMITE"]).default("SIMPLE"),
});

export type CreateResolutionInput = z.infer<typeof createResolutionSchema>;

/* ─── Vote ──────────────────────────────────────────────────────────── */

export const recordVoteSchema = z.object({
  resolutionId: z.string().cuid(),
  lotId: z.string().cuid(),
  vote: z.enum(["POUR", "CONTRE", "ABSTENTION"]),
  proxy: z.boolean().default(false),
  proxyName: z.string().max(200).optional(),
});

export type RecordVoteInput = z.infer<typeof recordVoteSchema>;
