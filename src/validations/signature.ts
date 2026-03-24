import { z } from "zod";

export const createSignatureRequestSchema = z.object({
  documentType: z.enum(["BAIL", "ETAT_DES_LIEUX", "MANDAT", "AUTRE"]),
  documentId: z.string().cuid().optional(),
  documentName: z.string().min(1, "Nom du document requis").max(200),
  /** Contenu PDF encode en base64 */
  documentBase64: z.string().min(1, "Document PDF requis"),
  signerEmail: z.string().email("Email invalide"),
  signerName: z.string().min(1, "Nom du signataire requis").max(200),
  subject: z.string().max(300).optional(),
  message: z.string().max(2000).optional(),
  /** true = signature embarquee dans l app (retour vers returnUrl) */
  embedded: z.boolean().default(false),
  returnUrl: z.string().url().optional(),
});

export type CreateSignatureRequestInput = z.infer<typeof createSignatureRequestSchema>;
