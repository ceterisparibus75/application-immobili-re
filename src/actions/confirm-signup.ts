"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import type { ActionResult } from "@/actions/society";

const confirmSignupSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  code: z
    .string()
    .length(6, "Le code doit contenir 6 chiffres")
    .regex(/^\d{6}$/, "Le code doit contenir uniquement des chiffres"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export type ConfirmSignupInput = z.infer<typeof confirmSignupSchema>;

export async function confirmSignup(
  input: ConfirmSignupInput
): Promise<ActionResult<{ email: string }>> {
  try {
    const parsed = confirmSignupSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { email, code, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Trouver l'utilisateur inactif avec ce code
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: "Aucun compte trouvé avec cette adresse email" };
    }

    if (user.isActive) {
      return { success: false, error: "Ce compte est déjà activé. Connectez-vous directement." };
    }

    if (!user.resetToken || user.resetToken !== code) {
      return { success: false, error: "Code de confirmation invalide" };
    }

    if (user.resetTokenExpiresAt && new Date() > user.resetTokenExpiresAt) {
      return { success: false, error: "Le code a expiré. Veuillez vous réinscrire." };
    }

    // Activer le compte avec le mot de passe définitif
    const passwordHash = await hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        emailVerified: new Date(),
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return { success: true, data: { email: normalizedEmail } };
  } catch (error) {
    console.error("[confirmSignup]", error);
    return { success: false, error: "Erreur lors de la confirmation du compte" };
  }
}

/** Renvoyer le code de confirmation */
export async function resendConfirmationCode(
  email: string
): Promise<ActionResult<{ email: string }>> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.isActive) {
      return { success: false, error: "Aucun compte en attente de confirmation" };
    }

    // Générer un nouveau code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: newCode,
        resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Envoyer le nouveau code par email
    const { sendSignupCodeEmail } = await import("@/lib/email");
    await sendSignupCodeEmail({
      to: normalizedEmail,
      name: user.name ?? normalizedEmail,
      code: newCode,
    }).catch((err) => console.error("[resendConfirmationCode] email error", err));

    return { success: true, data: { email: normalizedEmail } };
  } catch (error) {
    console.error("[resendConfirmationCode]", error);
    return { success: false, error: "Erreur lors du renvoi du code" };
  }
}
