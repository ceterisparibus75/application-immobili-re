"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { generatePortalMagicLink } from "@/lib/portal-magic-link";
import { getTenantDisplayName } from "@/lib/tenant-format";

const inputSchema = z.object({
  tenantId: z.string().cuid(),
  /**
   * Cible :
   *  - "primary" → tenant lui-même (Tenant.email)
   *  - "mandataire:{mandataireId}" → un mandataire spécifique
   */
  target: z.string(),
  ttlDays: z.number().int().min(1).max(30).optional(),
});

export async function sendPortalMagicLink(
  societyId: string,
  input: z.input<typeof inputSchema>
): Promise<ActionResult<{ email: string; expiresAt: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const { tenantId, target, ttlDays } = parsed.data;

    // Le tenant doit exister dans la société et être actif
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId, deletedAt: null, isActive: true },
      include: {
        society: { select: { name: true, id: true } },
        mandataires: true,
        portalAccess: true,
      },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    // Le portail doit être activé — sinon le magic link ne servirait à rien
    if (!tenant.portalAccess?.isActive) {
      return {
        success: false,
        error: "Le portail locataire n'est pas activé. Invitez d'abord le locataire depuis sa fiche.",
      };
    }

    // Résolution de la cible
    let email: string;
    let recipientName: string | null;
    let role: string | null;
    let mandataireId: string | null = null;

    if (target === "primary") {
      email = tenant.email;
      recipientName = getTenantDisplayName(tenant, "");
      role = null;
    } else if (target.startsWith("mandataire:")) {
      const mid = target.slice("mandataire:".length);
      const mandataire = tenant.mandataires.find((m) => m.id === mid);
      if (!mandataire) return { success: false, error: "Mandataire introuvable" };
      if (!mandataire.canAccessPortal) {
        return { success: false, error: "Ce mandataire n'a pas l'accès portail activé" };
      }
      email = mandataire.email;
      recipientName = mandataire.name;
      role = mandataire.role;
      mandataireId = mandataire.id;
    } else {
      return { success: false, error: "Cible invalide (attendu: primary ou mandataire:{id})" };
    }

    const { url, expiresAt } = await generatePortalMagicLink({
      tenantId,
      mandataireId,
      ttlDays,
    });

    // Envoi de l'email
    const { sendPortalMagicLinkEmail } = await import("@/lib/email");
    const result = await sendPortalMagicLinkEmail({
      to: email,
      recipientName,
      tenantName: getTenantDisplayName(tenant, tenant.society?.name ?? ""),
      societyName: tenant.society?.name ?? "",
      url,
      expiresAt,
      role,
    });
    if (!result.success) {
      return { success: false, error: `Envoi email échoué : ${result.error ?? "inconnu"}` };
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "SEND_EMAIL",
      entity: "PortalMagicLink",
      entityId: tenantId,
      details: {
        tenantId,
        mandataireId,
        recipient: email,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      success: true,
      data: { email, expiresAt: expiresAt.toISOString() },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[sendPortalMagicLink]", error);
    return { success: false, error: "Erreur lors de l'envoi du lien" };
  }
}
