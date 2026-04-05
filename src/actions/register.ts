"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { sendSignupConfirmationEmail } from "@/lib/email";
import type { ActionResult } from "@/actions/society";

const registerSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  firstName: z.string().min(1, "Le prénom est requis"),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]).optional().default("STARTER"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const specials = "!@#$%&*";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  password += specials[Math.floor(Math.random() * specials.length)];
  password += "A";
  password += "7";
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export async function registerUser(
  input: RegisterInput
): Promise<ActionResult<{ email: string }>> {
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
      return { success: false, error: "Un compte existe déjà avec cette adresse email" };
    }

    // Générer un mot de passe temporaire
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hash(tempPassword, 12);

    // Créer l'utilisateur — utiliser SQL brut pour compatibilité si colonnes manquantes
    try {
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          firstName: firstName.trim(),
          lastName: name.trim(),
          passwordHash,
        },
      });
    } catch (createError) {
      // Fallback : si firstName/lastName n'existent pas en base, créer avec les champs de base
      const msg = createError instanceof Error ? createError.message : "";
      if (msg.includes("column") || msg.includes("field") || msg.includes("Unknown arg")) {
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: fullName,
            passwordHash,
          },
        });
      } else {
        throw createError;
      }
    }

    // Envoyer l'email de confirmation avec le code provisoire
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mygestia.immo";
    await sendSignupConfirmationEmail({
      to: normalizedEmail,
      name: fullName,
      email: normalizedEmail,
      temporaryPassword: tempPassword,
      appUrl,
    }).catch((err) => console.error("[registerUser] email error", err));

    return { success: true, data: { email: normalizedEmail } };
  } catch (error) {
    console.error("[registerUser]", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Unique constraint")) {
      return { success: false, error: "Un compte existe déjà avec cette adresse email" };
    }
    return { success: false, error: `Erreur lors de la création du compte : ${message.slice(0, 200)}` };
  }
}
