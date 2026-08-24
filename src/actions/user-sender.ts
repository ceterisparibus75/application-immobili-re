"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/society";
import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import { UnauthenticatedActionError } from "@/lib/action-society";
import { createAuditLogsForUserSocieties } from "@/lib/audit";
import {
  deleteResendDomain,
  extractDomain,
  findOrCreateResendDomain,
  getResendDomain,
  isResendConfigured,
  verifyResendDomain,
  type ResendDomainDetails,
  type ResendDomainRecord,
} from "@/lib/resend-domains";

/**
 * Expéditeur unifié au niveau utilisateur.
 *
 * Contrairement à society-sender.ts (une adresse par société), ici un
 * utilisateur peut configurer UNE adresse qui servira à toutes les sociétés
 * dont il est ADMIN_SOCIETE (fallback si la société n'a pas son propre
 * sender vérifié). Utile pour un admin qui centralise ses envois.
 */

export type UnifiedSenderStatus =
  | "not_configured"
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure";

export interface UnifiedSenderOverview {
  senderEmail: string | null;
  senderName: string | null;
  domainId: string | null;
  status: UnifiedSenderStatus;
  verifiedAt: string | null;
  records: ResendDomainRecord[];
  resendConfigured: boolean;
  // Sociétés couvertes par ce sender (ADMIN_SOCIETE de l'utilisateur)
  coveredSocieties: Array<{ id: string; name: string; hasOwnSender: boolean }>;
}

const configureSchema = z.object({
  senderEmail: z.string().email("Adresse email invalide").max(254),
  senderName: z
    .string()
    .max(120, "120 caractères maximum")
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
});

function toStatus(raw: string | null | undefined): UnifiedSenderStatus {
  if (!raw) return "not_configured";
  const allowed: UnifiedSenderStatus[] = [
    "not_started",
    "pending",
    "verified",
    "failed",
    "temporary_failure",
  ];
  return (allowed as string[]).includes(raw) ? (raw as UnifiedSenderStatus) : "not_configured";
}

function toRecords(json: unknown): ResendDomainRecord[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (r): r is ResendDomainRecord =>
      typeof r === "object" && r !== null && typeof (r as { name?: unknown }).name === "string"
  );
}

async function loadCoveredSocieties(userId: string) {
  // Sociétés où le user est SUPER_ADMIN ou ADMIN_SOCIETE (les 2 rôles ont
  // le droit d'administrer la société — SUPER_ADMIN a même des droits
  // étendus). On inclut aussi les sociétés dont il est owner direct.
  const [memberships, owned] = await Promise.all([
    prisma.userSociety.findMany({
      where: { userId, role: { in: ["SUPER_ADMIN", "ADMIN_SOCIETE"] } },
      select: {
        society: { select: { id: true, name: true, senderStatus: true } },
      },
    }),
    prisma.society.findMany({
      where: { ownerId: userId, isActive: true },
      select: { id: true, name: true, senderStatus: true },
    }),
  ]);
  const merged = new Map<string, { id: string; name: string; senderStatus: string | null }>();
  for (const m of memberships) {
    if (m.society) merged.set(m.society.id, m.society);
  }
  for (const o of owned) merged.set(o.id, o);

  return Array.from(merged.values()).map((s) => ({
    id: s.id,
    name: s.name,
    hasOwnSender: s.senderStatus === "verified",
  }));
}

export async function getUnifiedSenderOverview(): Promise<ActionResult<UnifiedSenderOverview>> {
  try {
    const ctx = await requireAuthenticatedActionContext();
    const [user, covered] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          unifiedSenderEmail: true,
          unifiedSenderName: true,
          unifiedResendDomainId: true,
          unifiedSenderStatus: true,
          unifiedSenderVerifiedAt: true,
          unifiedSenderRecords: true,
        },
      }),
      loadCoveredSocieties(ctx.userId),
    ]);
    if (!user) return { success: false, error: "Utilisateur introuvable" };
    return {
      success: true,
      data: {
        senderEmail: user.unifiedSenderEmail,
        senderName: user.unifiedSenderName,
        domainId: user.unifiedResendDomainId,
        status: toStatus(user.unifiedSenderStatus),
        verifiedAt: user.unifiedSenderVerifiedAt?.toISOString() ?? null,
        records: toRecords(user.unifiedSenderRecords),
        resendConfigured: isResendConfigured(),
        coveredSocieties: covered,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[getUnifiedSenderOverview]", error);
    return { success: false, error: "Erreur lors de la récupération" };
  }
}

async function persistDomain(
  userId: string,
  input: { senderEmail: string; senderName?: string },
  details: ResendDomainDetails
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      unifiedSenderEmail: input.senderEmail,
      unifiedSenderName: input.senderName ?? null,
      unifiedResendDomainId: details.id,
      unifiedSenderStatus: details.status,
      unifiedSenderVerifiedAt: details.status === "verified" ? new Date() : null,
      unifiedSenderRecords: details.records as unknown as object,
    },
  });
}

export async function configureUnifiedSender(input: {
  senderEmail: string;
  senderName?: string;
}): Promise<ActionResult<UnifiedSenderOverview>> {
  try {
    const ctx = await requireAuthenticatedActionContext();
    if (!isResendConfigured()) {
      return { success: false, error: "Le fournisseur d'emails (Resend) n'est pas configuré." };
    }
    const parsed = configureSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const domain = extractDomain(parsed.data.senderEmail);
    if (!domain) return { success: false, error: "Adresse expéditrice invalide" };

    const existing = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { unifiedResendDomainId: true, unifiedSenderEmail: true },
    });
    const existingDomain = existing?.unifiedSenderEmail ? extractDomain(existing.unifiedSenderEmail) : null;

    if (existing?.unifiedResendDomainId && existingDomain === domain) {
      // Même domaine : refresh depuis Resend
      const details = await getResendDomain(existing.unifiedResendDomainId);
      await persistDomain(ctx.userId, parsed.data, details);
    } else {
      // Changement de domaine : supprimer l'ancien puis créer
      if (existing?.unifiedResendDomainId) {
        try {
          await deleteResendDomain(existing.unifiedResendDomainId);
        } catch (err) {
          console.warn("[configureUnifiedSender] delete previous", err);
        }
      }
      // findOrCreate : réutilise le domaine s'il est déjà enregistré chez
      // Resend (ex: par une société MyGestia qui l'a créé avant).
      const created = await findOrCreateResendDomain(domain);
      await persistDomain(ctx.userId, parsed.data, created);
    }

    await createAuditLogsForUserSocieties({
      userId: ctx.userId,
      action: "UPDATE",
      entity: "User",
      entityId: ctx.userId,
      details: { action: "configure_unified_sender", domain, senderEmail: parsed.data.senderEmail },
    });

    revalidatePath("/parametres");
    return await getUnifiedSenderOverview();
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[configureUnifiedSender]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la configuration",
    };
  }
}

export async function verifyUnifiedSender(): Promise<ActionResult<UnifiedSenderOverview>> {
  try {
    const ctx = await requireAuthenticatedActionContext();
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { unifiedResendDomainId: true },
    });
    if (!user?.unifiedResendDomainId) {
      return { success: false, error: "Aucun domaine à vérifier." };
    }
    await verifyResendDomain(user.unifiedResendDomainId);
    const details = await getResendDomain(user.unifiedResendDomainId);
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        unifiedSenderStatus: details.status,
        unifiedSenderVerifiedAt: details.status === "verified" ? new Date() : null,
        unifiedSenderRecords: details.records as unknown as object,
      },
    });
    await createAuditLogsForUserSocieties({
      userId: ctx.userId,
      action: "UPDATE",
      entity: "User",
      entityId: ctx.userId,
      details: { action: "verify_unified_sender", status: details.status },
    });
    revalidatePath("/parametres");
    return await getUnifiedSenderOverview();
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[verifyUnifiedSender]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la vérification",
    };
  }
}

export async function refreshUnifiedSenderStatus(): Promise<ActionResult<UnifiedSenderOverview>> {
  try {
    const ctx = await requireAuthenticatedActionContext();
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { unifiedResendDomainId: true },
    });
    if (!user?.unifiedResendDomainId) return await getUnifiedSenderOverview();
    const details = await getResendDomain(user.unifiedResendDomainId);
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        unifiedSenderStatus: details.status,
        unifiedSenderVerifiedAt: details.status === "verified" ? new Date() : null,
        unifiedSenderRecords: details.records as unknown as object,
      },
    });
    revalidatePath("/parametres");
    return await getUnifiedSenderOverview();
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[refreshUnifiedSenderStatus]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors du rafraîchissement",
    };
  }
}

export async function removeUnifiedSender(): Promise<ActionResult<UnifiedSenderOverview>> {
  try {
    const ctx = await requireAuthenticatedActionContext();
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { unifiedResendDomainId: true },
    });
    if (user?.unifiedResendDomainId) {
      try {
        await deleteResendDomain(user.unifiedResendDomainId);
      } catch (err) {
        console.warn("[removeUnifiedSender] delete", err);
      }
    }
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        unifiedSenderEmail: null,
        unifiedSenderName: null,
        unifiedResendDomainId: null,
        unifiedSenderStatus: null,
        unifiedSenderVerifiedAt: null,
        unifiedSenderRecords: Prisma.JsonNull,
      },
    });
    await createAuditLogsForUserSocieties({
      userId: ctx.userId,
      action: "UPDATE",
      entity: "User",
      entityId: ctx.userId,
      details: { action: "remove_unified_sender" },
    });
    revalidatePath("/parametres");
    return await getUnifiedSenderOverview();
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    console.error("[removeUnifiedSender]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la suppression",
    };
  }
}
