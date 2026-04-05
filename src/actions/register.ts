"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { sendSignupCodeEmail } from "@/lib/email";
import type { ActionResult } from "@/actions/society";

const registerSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  firstName: z.string().min(1, "Le prénom est requis"),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]).optional().default("STARTER"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export type RegisterResult = {
  success: boolean;
  data?: { email: string };
  error?: string;
  code?: "ACCOUNT_EXISTS";
};

/** Génère un code de confirmation à 6 chiffres */
function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerUser(
  input: RegisterInput
): Promise<RegisterResult> {
  try {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { email, name, firstName } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const fullName = `${firstName.trim()} ${name.trim()}`;

    // Vérifier que l'email n'est pas déjà utilisé
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      // Si le compte existe mais n'est pas activé, le supprimer pour permettre une nouvelle inscription
      if (!existing.isActive && existing.resetToken) {
        await prisma.user.delete({ where: { id: existing.id } });
      } else {
        return { success: false, error: "Un compte existe déjà avec cette adresse email", code: "ACCOUNT_EXISTS" };
      }
    }

    // Générer un code de confirmation — le mot de passe sera défini par le client
    const confirmationCode = generateConfirmationCode();
    const placeholderHash = await hash(crypto.randomUUID(), 12);

    // Créer l'utilisateur inactif avec le code dans resetToken
    try {
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          firstName: firstName.trim(),
          lastName: name.trim(),
          passwordHash: placeholderHash,
          isActive: false,
          resetToken: confirmationCode,
          resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        },
      });
    } catch (createError) {
      // Fallback si certaines colonnes n'existent pas en base
      const msg = createError instanceof Error ? createError.message : "";
      if (msg.includes("column") || msg.includes("field") || msg.includes("Unknown arg")) {
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: fullName,
            passwordHash: placeholderHash,
            isActive: false,
            resetToken: confirmationCode,
            resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      } else {
        throw createError;
      }
    }

    // Envoyer l'email avec le code de confirmation
    await sendSignupCodeEmail({
      to: normalizedEmail,
      name: fullName,
      code: confirmationCode,
    }).catch((err) => console.error("[registerUser] email error", err));

    return { success: true, data: { email: normalizedEmail } };
  } catch (error) {
    console.error("[registerUser]", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Unique constraint")) {
      return { success: false, error: "Un compte existe déjà avec cette adresse email", code: "ACCOUNT_EXISTS" };
    }
    return { success: false, error: `Erreur lors de la création du compte : ${message.slice(0, 200)}` };
  }
}
