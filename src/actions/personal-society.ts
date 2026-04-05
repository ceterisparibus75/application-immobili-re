"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

/**
 * Crée une "société" pour un propriétaire personne physique.
 * Utilise les données du profil utilisateur pour pré-remplir.
 * Génère un SIRET fictif interne (00000000000000 + suffixe unique).
 */
export async function createPersonalSociety(): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

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

    // Générer un SIRET interne unique pour personne physique (préfixé 00000000)
    const suffix = Date.now().toString().slice(-6);
    const personalSiret = `00000000${suffix.padStart(6, "0")}`;

    const society = await prisma.society.create({
      data: {
        name: `${ownerName} — Nom propre`,
        legalForm: "AUTRE",
        siret: personalSiret,
        addressLine1: user.address ?? "À compléter",
        city: user.ownerCity ?? "À compléter",
        postalCode: user.postalCode ?? "00000",
        country: "France",
        taxRegime: "IR",
        vatRegime: "FRANCHISE",
        phone: user.phone ?? null,
        signatoryName: ownerName,
        ownerId: session.user.id,
      },
    });

    // Assigner le créateur comme ADMIN_SOCIETE
    await prisma.userSociety.create({
      data: {
        userId: session.user.id,
        societyId: society.id,
        role: "ADMIN_SOCIETE",
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
