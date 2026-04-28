"use server";

import { update } from "@/lib/auth";
import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import { verifyTOTP, decryptRecoveryCodes } from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/society";
import { createAuditLogsForUserSocieties } from "@/lib/audit";
import { timingSafeEqual } from "crypto";
import { UnauthenticatedActionError } from "@/lib/action-society";

export async function completeTwoFactorLogin(code: string): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const context = await requireAuthenticatedActionContext();

    if (!context.session.requires2FA) {
      return { success: false, error: "2FA non requis" };
    }

    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { twoFactorSecret: true, twoFactorRecoveryCodes: true },
    });

    if (!user?.twoFactorSecret) {
      return { success: false, error: "Configuration 2FA introuvable" };
    }

    const isValidTOTP = verifyTOTP(user.twoFactorSecret, code.replace(/\s/g, ""));

    if (!isValidTOTP) {
      // Verify recovery code using constant-time comparison to prevent timing attacks
      const decryptedCodes = decryptRecoveryCodes(user.twoFactorRecoveryCodes);
      const inputCode = code.trim().toUpperCase();
      const codeIndex = decryptedCodes.findIndex((c) => {
        if (c.length !== inputCode.length) return false;
        try {
          return timingSafeEqual(Buffer.from(c), Buffer.from(inputCode));
        } catch {
          return false;
        }
      });

      if (codeIndex === -1) {
        return { success: false, error: "Code invalide ou expire" };
      }

      // Supprimer le code de recuperation utilise (usage unique)
      const newEncryptedCodes = user.twoFactorRecoveryCodes.filter((_, i) => i !== codeIndex);
      await prisma.user.update({
        where: { id: context.userId },
        data: { twoFactorRecoveryCodes: newEncryptedCodes },
      });
    }

    await update({ requires2FA: false, twoFactorVerified: true });
    await createAuditLogsForUserSocieties({
      userId: context.userId,
      action: "LOGIN",
      entity: "User",
      entityId: context.userId,
      details: { event: "TWO_FACTOR_LOGIN" },
    });
    return { success: true, data: { redirectTo: "/proprietaire" } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    console.error("[completeTwoFactorLogin]", error);
    return { success: false, error: "Erreur lors de la verification" };
  }
}
