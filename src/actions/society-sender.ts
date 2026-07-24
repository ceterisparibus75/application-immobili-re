"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  createResendDomain,
  deleteResendDomain,
  extractDomain,
  getResendDomain,
  isResendConfigured,
  verifyResendDomain,
  type ResendDomainDetails,
  type ResendDomainRecord,
} from "@/lib/resend-domains";

export type SenderStatus =
  | "not_configured"
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure";

export interface SenderOverview {
  senderEmail: string | null;
  senderName: string | null;
  domainId: string | null;
  status: SenderStatus;
  verifiedAt: string | null;
  records: ResendDomainRecord[];
  resendConfigured: boolean;
}

const configureSenderSchema = z.object({
  senderEmail: z.string().email("Adresse email invalide").max(254),
  senderName: z
    .string()
    .max(120, "120 caractères maximum")
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
});

function toSenderStatus(raw: string | null | undefined): SenderStatus {
  if (!raw) return "not_configured";
  const allowed: SenderStatus[] = [
    "not_started",
    "pending",
    "verified",
    "failed",
    "temporary_failure",
  ];
  return (allowed as string[]).includes(raw) ? (raw as SenderStatus) : "not_configured";
}

function toRecords(json: unknown): ResendDomainRecord[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (r): r is ResendDomainRecord =>
      typeof r === "object" && r !== null && typeof (r as { name?: unknown }).name === "string"
  );
}

export async function getSenderOverview(
  societyId: string
): Promise<ActionResult<SenderOverview>> {
  try {
    await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: {
        senderEmail: true,
        senderName: true,
        resendDomainId: true,
        senderStatus: true,
        senderVerifiedAt: true,
        senderRecords: true,
      },
    });
    if (!society) return { success: false, error: "Société introuvable" };
    return {
      success: true,
      data: {
        senderEmail: society.senderEmail,
        senderName: society.senderName,
        domainId: society.resendDomainId,
        status: toSenderStatus(society.senderStatus),
        verifiedAt: society.senderVerifiedAt?.toISOString() ?? null,
        records: toRecords(society.senderRecords),
        resendConfigured: isResendConfigured(),
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getSenderOverview]", error);
    return { success: false, error: "Erreur lors de la récupération de l'expediteur" };
  }
}

async function persistDomain(
  societyId: string,
  input: { senderEmail: string; senderName?: string },
  details: ResendDomainDetails
): Promise<void> {
  await prisma.society.update({
    where: { id: societyId },
    data: {
      senderEmail: input.senderEmail,
      senderName: input.senderName ?? null,
      resendDomainId: details.id,
      senderStatus: details.status,
      senderVerifiedAt: details.status === "verified" ? new Date() : null,
      senderRecords: details.records as unknown as object,
    },
  });
}

export async function configureSenderDomain(
  societyId: string,
  input: { senderEmail: string; senderName?: string }
): Promise<ActionResult<SenderOverview>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    if (!isResendConfigured()) {
      return { success: false, error: "Le fournisseur d'emails (Resend) n'est pas configuré côté serveur." };
    }
    const parsed = configureSenderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const domain = extractDomain(parsed.data.senderEmail);
    if (!domain) return { success: false, error: "Adresse expéditrice invalide" };

    const existing = await prisma.society.findUnique({
      where: { id: societyId },
      select: { resendDomainId: true, senderEmail: true },
    });

    // Cas 1 : même domaine déjà déclaré → on rafraîchit juste depuis Resend.
    const existingDomainFromDb = existing?.senderEmail ? extractDomain(existing.senderEmail) : null;
    if (existing?.resendDomainId && existingDomainFromDb === domain) {
      const details = await getResendDomain(existing.resendDomainId);
      await persistDomain(societyId, parsed.data, details);
    } else {
      // Cas 2 : changement de domaine → supprimer l'ancien puis créer le nouveau.
      if (existing?.resendDomainId) {
        try {
          await deleteResendDomain(existing.resendDomainId);
        } catch (err) {
          // Non bloquant : le domaine peut avoir déjà été supprimé côté Resend.
          console.warn("[configureSenderDomain] delete previous", err);
        }
      }
      const created = await createResendDomain(domain);
      await persistDomain(societyId, parsed.data, created);
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { action: "configure_sender_domain", domain, senderEmail: parsed.data.senderEmail },
    });

    revalidatePath("/parametres/facturation");
    revalidatePath("/parametres/expediteur");

    const overview = await getSenderOverview(societyId);
    return overview;
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[configureSenderDomain]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la configuration de l'expediteur",
    };
  }
}

export async function verifySenderDomain(
  societyId: string
): Promise<ActionResult<SenderOverview>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { resendDomainId: true },
    });
    if (!society?.resendDomainId) {
      return { success: false, error: "Aucun domaine configuré pour cette société." };
    }

    // Déclenche la vérification côté Resend (asynchrone) puis récupère l'état.
    await verifyResendDomain(society.resendDomainId);
    const details = await getResendDomain(society.resendDomainId);
    await prisma.society.update({
      where: { id: societyId },
      data: {
        senderStatus: details.status,
        senderVerifiedAt: details.status === "verified" ? new Date() : null,
        senderRecords: details.records as unknown as object,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { action: "verify_sender_domain", status: details.status },
    });

    revalidatePath("/parametres/facturation");
    revalidatePath("/parametres/expediteur");

    return await getSenderOverview(societyId);
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[verifySenderDomain]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la vérification",
    };
  }
}

export async function refreshSenderStatus(
  societyId: string
): Promise<ActionResult<SenderOverview>> {
  try {
    await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { resendDomainId: true },
    });
    if (!society?.resendDomainId) return await getSenderOverview(societyId);
    const details = await getResendDomain(society.resendDomainId);
    await prisma.society.update({
      where: { id: societyId },
      data: {
        senderStatus: details.status,
        senderVerifiedAt: details.status === "verified" ? new Date() : null,
        senderRecords: details.records as unknown as object,
      },
    });
    revalidatePath("/parametres/facturation");
    revalidatePath("/parametres/expediteur");
    return await getSenderOverview(societyId);
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[refreshSenderStatus]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors du rafraîchissement",
    };
  }
}

export async function removeSenderDomain(
  societyId: string
): Promise<ActionResult<SenderOverview>> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: { resendDomainId: true },
    });
    if (society?.resendDomainId) {
      try {
        await deleteResendDomain(society.resendDomainId);
      } catch (err) {
        // Ignoré : nettoyage côté DB même si Resend a déjà oublié le domaine.
        console.warn("[removeSenderDomain] resend delete", err);
      }
    }
    await prisma.society.update({
      where: { id: societyId },
      data: {
        senderEmail: null,
        senderName: null,
        resendDomainId: null,
        senderStatus: null,
        senderVerifiedAt: null,
        senderRecords: Prisma.JsonNull,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Society",
      entityId: societyId,
      details: { action: "remove_sender_domain" },
    });

    revalidatePath("/parametres/facturation");
    revalidatePath("/parametres/expediteur");

    return await getSenderOverview(societyId);
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[removeSenderDomain]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la suppression",
    };
  }
}
