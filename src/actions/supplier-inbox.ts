"use server";

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  upsertSupplierInboxConfigSchema,
  type UpsertSupplierInboxConfigInput,
} from "@/validations/supplier-invoice";

// ─── Upsert de la config inbox ────────────────────────────────────────────────

export async function upsertSupplierInboxConfig(
  societyId: string,
  input: UpsertSupplierInboxConfigInput
): Promise<ActionResult<{ id: string; inboxEmail: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const parsed = upsertSupplierInboxConfigSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const existing = await prisma.supplierInboxConfig.findUnique({
      where: { societyId },
    });

    if (existing) {
      const updated = await prisma.supplierInboxConfig.update({
        where: { societyId },
        data: {
          notifyEmails: parsed.data.notifyEmails,
          isActive: parsed.data.isActive,
        },
      });

      revalidatePath("/parametres/facturation");
      return { success: true, data: { id: updated.id, inboxEmail: updated.inboxEmail } };
    }

    // Création d'une nouvelle config
    const inboxSlug =
      societyId.slice(-8).toLowerCase() + "-" + randomUUID().slice(0, 4);
    const inboxEmail = `factures-${inboxSlug}@inbox.mygestia.immo`;
    const webhookSecretHash = await bcrypt.hash(randomUUID(), 10);

    const created = await prisma.supplierInboxConfig.create({
      data: {
        societyId,
        inboxSlug,
        inboxEmail,
        webhookSecretHash,
        notifyEmails: parsed.data.notifyEmails,
        isActive: parsed.data.isActive,
      },
    });

    revalidatePath("/parametres/facturation");
    return { success: true, data: { id: created.id, inboxEmail: created.inboxEmail } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[upsertSupplierInboxConfig]", error);
    return { success: false, error: "Erreur lors de la mise à jour de la configuration" };
  }
}

// ─── Lecture de la config (sans le hash secret) ───────────────────────────────

export async function getSupplierInboxConfig(
  societyId: string
): Promise<{
  id: string;
  inboxEmail: string;
  inboxSlug: string;
  isActive: boolean;
  notifyEmails: string[];
} | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const config = await prisma.supplierInboxConfig.findUnique({
      where: { societyId },
      select: {
        id: true,
        inboxEmail: true,
        inboxSlug: true,
        isActive: true,
        notifyEmails: true,
        // webhookSecretHash intentionnellement exclu
      },
    });

    return config;
  } catch (error) {
    console.error("[getSupplierInboxConfig]", error);
    return null;
  }
}

// ─── Régénération du secret webhook ──────────────────────────────────────────

export async function regenerateInboxSecret(
  societyId: string
): Promise<ActionResult<{ rawSecret: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const existing = await prisma.supplierInboxConfig.findUnique({
      where: { societyId },
    });
    if (!existing) {
      return { success: false, error: "Configuration inbox introuvable" };
    }

    const rawSecret = randomUUID();
    const webhookSecretHash = await bcrypt.hash(rawSecret, 10);

    await prisma.supplierInboxConfig.update({
      where: { societyId },
      data: { webhookSecretHash },
    });

    // rawSecret est retourné une seule fois, jamais stocké en clair
    return { success: true, data: { rawSecret } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[regenerateInboxSecret]", error);
    return { success: false, error: "Erreur lors de la régénération du secret" };
  }
}
