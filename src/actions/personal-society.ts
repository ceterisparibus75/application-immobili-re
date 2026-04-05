"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/society";

const personalSocietySchema = z.object({
  siret: z
    .string()
    .regex(/^\d{14}$/, "Le SIRET doit contenir exactement 14 chiffres")
    .optional()
    .or(z.literal("")),
  addressLine1: z.string().optional().or(z.literal("")),
  postalCode: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  taxRegime: z.enum(["IS", "IR"]).optional().default("IR"),
  vatRegime: z.enum(["TVA", "FRANCHISE"]).optional().default("FRANCHISE"),
  proprietaireId: z.string().cuid().optional(),
});

export type PersonalSocietyInput = z.infer<typeof personalSocietySchema>;

/**
 * Crée une "société" pour un propriétaire personne physique.
 * SIRET optionnel (utile pour les LMNP par exemple).
 */
export async function createPersonalSociety(
  input?: PersonalSocietyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = personalSocietySchema.safeParse(input ?? {});
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }
    const data = parsed.data;

    // Récupérer le profil utilisateur
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        ownerCity: true,
        phone: true,
        email: true,
      },
    });

    if (!user) {
      return { success: false, error: "Utilisateur introuvable" };
    }

    const ownerName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name ?? "Propriétaire";

    // SIRET : utiliser celui fourni, ou générer un interne
    let siret = data.siret?.trim() || "";
    if (!siret) {
      const suffix = Date.now().toString().slice(-6);
      siret = `00000000${suffix.padStart(6, "0")}`;
    }

    // Vérifier unicité SIRET
    const existingSiret = await prisma.society.findUnique({ where: { siret } });
    if (existingSiret) {
      return { success: false, error: "Ce SIRET est déjà enregistré" };
    }

    const society = await prisma.society.create({
      data: {
        name: `${ownerName} — Nom propre`,
        legalForm: "AUTRE",
        siret,
        addressLine1: data.addressLine1?.trim() || user.address || "À compléter",
        city: data.city?.trim() || user.ownerCity || "À compléter",
        postalCode: data.postalCode?.trim() || user.postalCode || "00000",
        country: "France",
        taxRegime: data.taxRegime ?? "IR",
        vatRegime: data.vatRegime ?? "FRANCHISE",
        phone: user.phone ?? null,
        signatoryName: ownerName,
        ownerId: session.user.id,
        proprietaireId: data.proprietaireId || null,
      },
    });

    await prisma.userSociety.create({
      data: {
        userId: session.user.id,
        societyId: society.id,
        role: "ADMIN_SOCIETE",
      },
    });

    // Créer un abonnement d'essai implicite (14 jours)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await prisma.subscription.create({
      data: {
        societyId: society.id,
        planId: "STARTER",
        status: "TRIALING",
        trialStart: new Date(),
        trialEnd,
      },
    });

    await createAuditLog({
      societyId: society.id,
      userId: session.user.id,
      action: "CREATE",
      entity: "Society",
      entityId: society.id,
      details: { name: society.name, type: "PERSONNE_PHYSIQUE" },
    });

    revalidatePath("/", "layout");
    revalidatePath("/societes");
    revalidatePath("/dashboard");

    return { success: true, data: { id: society.id } };
  } catch (error) {
    console.error("[createPersonalSociety]", error);
    return { success: false, error: "Erreur lors de la création de l'espace propriétaire" };
  }
}
