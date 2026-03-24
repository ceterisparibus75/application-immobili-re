"use server";

import { auth, update } from "@/lib/auth";
import { verifyTOTP } from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/society";

export async function completeTwoFactorLogin(code: string): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    if (!session.requires2FA) {
      return { success: false, error: "2FA non requis" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      return { success: false, error: "Configuration 2FA introuvable" };
    }

    const isValid = verifyTOTP(user.twoFactorSecret, code.replace(/\s/g, ""));
    if (!isValid) {
      return { success: false, error: "Code invalide ou expire" };
    }

    await update({ requires2FA: false, twoFactorVerified: true });
    return { success: true, data: { redirectTo: "/dashboard" } };
  } catch (error) {
    console.error("[completeTwoFactorLogin]", error);
    return { success: false, error: "Erreur lors de la verification" };
  }
}
