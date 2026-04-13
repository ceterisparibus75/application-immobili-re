import { z } from "zod";

/* ─── Ligne de relevé ──────────────────────────────────────────────── */

export const statementLineSchema = z.object({
  lineType: z.enum(["CHARGE", "ENCAISSEMENT", "DEDUCTION", "HONORAIRES"]),
  label: z.string().min(1, "Libellé requis").max(300),
  amount: z.number(),
  categoryId: z.string().cuid().optional(),
  nature: z.enum(["PROPRIETAIRE", "RECUPERABLE", "MIXTE"]).optional(),
  recoverableRate: z.number().min(0).max(100).optional(),
});

export type StatementLineInput = z.infer<typeof statementLineSchema>;

/* ─── Création de relevé ───────────────────────────────────────────── */

const createStatementBaseSchema = z.object({
  type: z.enum(["APPEL_FONDS", "DECOMPTE_CHARGES", "DECOMPTE_GESTION"]),
  buildingId: z.string().cuid().optional(),
  leaseId: z.string().cuid().optional(),
  thirdPartyName: z.string().min(1, "Nom du tiers requis").max(200),
  contactId: z.string().cuid().optional(),
  reference: z.string().max(100).optional(),
  periodStart: z.string().min(1, "Date de début requise"),
  periodEnd: z.string().min(1, "Date de fin requise"),
  periodLabel: z.string().max(100).optional(),
  receivedDate: z.string().min(1, "Date de réception requise"),
  dueDate: z.string().optional(),
  totalAmount: z.number(),
  netAmount: z.number().optional(),
  notes: z.string().max(5000).optional(),
  lines: z.array(statementLineSchema).min(1, "Au moins une ligne requise"),
});

export const createStatementSchema = createStatementBaseSchema.refine(
  (data) => {
    if (data.type === "DECOMPTE_GESTION" && !data.leaseId) return false;
    if ((data.type === "APPEL_FONDS" || data.type === "DECOMPTE_CHARGES") && !data.buildingId) return false;
    return true;
  },
  { message: "Immeuble requis pour syndic, bail requis pour gestion locative" }
);

export type CreateStatementInput = z.infer<typeof createStatementSchema>;

/* ─── Mise à jour ──────────────────────────────────────────────────── */

export const updateStatementSchema = createStatementBaseSchema.partial().extend({
  id: z.string().cuid(),
});

export type UpdateStatementInput = z.infer<typeof updateStatementSchema>;

/* ─── Paiement d'un appel ─────────────────────────────────────────── */

export const recordStatementPaymentSchema = z.object({
  statementId: z.string().cuid(),
  amount: z.number().positive("Montant requis"),
  paidAt: z.string().min(1, "Date requise"),
  method: z.string().max(50).optional(),
  reference: z.string().max(200).optional(),
});

export type RecordStatementPaymentInput = z.infer<typeof recordStatementPaymentSchema>;
