"use server";

import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import { UnauthenticatedActionError } from "@/lib/action-society";
import {
  generateTOTPSecret,
  generateTOTPUri,
  generateQRCode,
  encryptTOTPSecret,
  decryptTOTPSecret,
  generateRecoveryCodes,
  encryptRecoveryCodes,
} from "@/lib/two-factor";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { compareSync } from "bcryptjs";
import { createAuditLog } from "@/lib/audit";
import { requiresTwoFactor } from "@/lib/plan-limits";

export async function initSetupTwoFactor(): Promise<ActionResult<{ qrCode: string; secret: string }>> {
  try {
    const context = await requireAuthenticatedActionContext();

    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) return { success: false, error: "Utilisateur introuvable" };
    if (user.twoFactorEnabled) return { success: false, error: "2FA deja active" };

    const secret = generateTOTPSecret();
    const uri = generateTOTPUri(secret, user.email);
    const qrCode = await generateQRCode(uri);

    // Stocker le secret temporaire chiffre en DB (pas dans le JWT)
    await prisma.user.update({
      where: { id: context.userId },
      data: { pendingTwoFactorSecret: encryptTOTPSecret(secret) },
    });

    // Le secret est retourne en clair uniquement pour permettre la saisie manuelle
    // dans l'application d'authentification. Il n'est jamais stocke cote client.
    return { success: true, data: { qrCode, secret } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    console.error("[initSetupTwoFactor]", error);
    return { success: false, error: "Erreur lors de l'initialisation" };
  }
}

export async function confirmSetupTwoFactor(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  try {
    const context = await requireAuthenticatedActionContext();

    // Lire le secret temporaire depuis la DB (chiffre)
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { pendingTwoFactorSecret: true },
    });
    if (!user?.pendingTwoFactorSecret) return { success: false, error: "Aucune configuration 2FA en attente" };
    const pendingSecret = decryptTOTPSecret(user.pendingTwoFactorSecret);

    // Verifier le code avec le secret temporaire (dechiffre)
    const { TOTP, Secret } = await import("otpauth");
    const totp = new TOTP({
      issuer: process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia",
      label: "account",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(pendingSecret),
    });
    const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
    if (delta === null) return { success: false, error: "Code invalide ou expire" };

    const encryptedSecret = encryptTOTPSecret(pendingSecret);
    const recoveryCodes = generateRecoveryCodes(8);
    const encryptedRecoveryCodes = encryptRecoveryCodes(recoveryCodes);

    await prisma.user.update({
      where: { id: context.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encryptedSecret,
        twoFactorRecoveryCodes: encryptedRecoveryCodes,
        pendingTwoFactorSecret: null,
      },
    });

    revalidatePath("/settings/security");
    await createAuditLog({
      societyId: "system",
      userId: context.userId,
      action: "UPDATE",
      entity: "User",
      entityId: context.userId,
      details: { event: "TWO_FACTOR_ENABLED" },
    });
    return { success: true, data: { recoveryCodes } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    console.error("[confirmSetupTwoFactor]", error);
    return { success: false, error: "Erreur lors de la confirmation" };
  }
}

export async function disableTwoFactor(password: string): Promise<ActionResult<void>> {
  try {
    const context = await requireAuthenticatedActionContext();

    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { passwordHash: true, twoFactorEnabled: true },
    });

    if (!user) return { success: false, error: "Utilisateur introuvable" };
    if (!user.twoFactorEnabled) return { success: false, error: "2FA non active" };

    // Empecher la desactivation si le plan exige le 2FA
    const mandatory = await requiresTwoFactor(context.userId);
    if (mandatory) {
      return {
        success: false,
        error: "L'authentification a deux facteurs est obligatoire pour les comptes Institutionnel.",
      };
    }

    if (!user.passwordHash || !compareSync(password, user.passwordHash)) {
      return { success: false, error: "Mot de passe incorrect" };
    }

    await prisma.user.update({
      where: { id: context.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] },
    });

    revalidatePath("/settings/security");
    await createAuditLog({
      societyId: "system",
      userId: context.userId,
      action: "UPDATE",
      entity: "User",
      entityId: context.userId,
      details: { event: "TWO_FACTOR_DISABLED" },
    });
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifie" };
    console.error("[disableTwoFactor]", error);
    return { success: false, error: "Erreur lors de la desactivation" };
  }
}
