"use server";

import { prisma } from "@/lib/prisma";
import { createAuditLogsForUserSocieties } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import { UnauthenticatedActionError } from "@/lib/action-society";

export interface UserPreferences {
  dailyDigestEnabled: boolean;
  dailyDigestLastSentAt: string | null;
}

/**
 * Lit les préférences de l'utilisateur courant.
 * Aucun contexte société requis — ce sont des préférences globales du compte.
 */
export async function getMyPreferences(): Promise<ActionResult<UserPreferences>> {
  try {
    const context = await requireAuthenticatedActionContext();
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { dailyDigestEnabled: true, dailyDigestLastSentAt: true },
    });
    if (!user) return { success: false, error: "Utilisateur introuvable" };
    return {
      success: true,
      data: {
        dailyDigestEnabled: user.dailyDigestEnabled,
        dailyDigestLastSentAt: user.dailyDigestLastSentAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[getMyPreferences]", error);
    return { success: false, error: "Erreur lors de la récupération des préférences" };
  }
}

export async function toggleDailyDigest(enabled: boolean): Promise<ActionResult<UserPreferences>> {
  try {
    const context = await requireAuthenticatedActionContext();
    await prisma.user.update({
      where: { id: context.userId },
      data: { dailyDigestEnabled: enabled },
    });
    // Préférence globale du compte : audit répliqué sur toutes les sociétés
    // auxquelles l'utilisateur est rattaché, comme pour les événements auth.
    await createAuditLogsForUserSocieties({
      userId: context.userId,
      action: "UPDATE",
      entity: "User",
      entityId: context.userId,
      details: { action: "TOGGLE_DAILY_DIGEST", enabled },
    });
    revalidatePath("/parametres");
    return await getMyPreferences();
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[toggleDailyDigest]", error);
    return { success: false, error: "Erreur lors de la modification" };
  }
}
