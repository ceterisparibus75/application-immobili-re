import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const createUserSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  firstName: z.string().optional().or(z.literal("")),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
    ),
});

export const updateUserSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2).optional(),
  firstName: z.string().optional().or(z.literal("")),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

export const assignUserToSocietySchema = z.object({
  userId: z.string().cuid(),
  societyId: z.string().cuid(),
  role: z.enum([
    "SUPER_ADMIN",
    "ADMIN_SOCIETE",
    "GESTIONNAIRE",
    "COMPTABLE",
    "LECTURE",
  ]),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
    newPassword: z
      .string()
      .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignUserToSocietyInput = z.infer<typeof assignUserToSocietySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
