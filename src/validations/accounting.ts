import { z } from "zod";

export const createFiscalYearSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  startDate: z.string().min(1, "Date de début requise"),
  endDate: z.string().min(1, "Date de fin requise"),
});

export const journalEntryLineSchema = z.object({
  accountId: z.string().min(1, "Compte requis"),
  label: z.string().max(255).optional(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
});

export const createJournalEntrySchema = z.object({
  journalType: z.string().min(1, "Journal requis"),
  entryDate: z.string().min(1, "Date requise"),
  piece: z.string().max(50).optional(),
  label: z.string().min(1, "Libellé requis").max(255),
  fiscalYearId: z.string().optional(),
  lines: z.array(journalEntryLineSchema).min(2, "Au moins 2 lignes requises"),
});

export type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
