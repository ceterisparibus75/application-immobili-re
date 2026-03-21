import { z } from "zod";

export const portalActivateSchema = z.object({
  email: z.string().email("Email invalide").transform((v) => v.toLowerCase()),
  code: z
    .string()
    .length(6, "Le code doit contenir 6 chiffres")
    .regex(/^\d{6}$/, "Le code doit être composé de chiffres uniquement"),
});

export const portalLoginRequestSchema = z.object({
  email: z.string().email("Email invalide").transform((v) => v.toLowerCase()),
});

export const portalLoginVerifySchema = z.object({
  email: z.string().email("Email invalide").transform((v) => v.toLowerCase()),
  code: z
    .string()
    .length(6, "Le code doit contenir 6 chiffres")
    .regex(/^\d{6}$/, "Le code doit être composé de chiffres uniquement"),
});

export type PortalActivateInput = z.infer<typeof portalActivateSchema>;
export type PortalLoginRequestInput = z.infer<typeof portalLoginRequestSchema>;
export type PortalLoginVerifyInput = z.infer<typeof portalLoginVerifySchema>;
