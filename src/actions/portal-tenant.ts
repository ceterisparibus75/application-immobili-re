"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePortalAuth } from "@/lib/portal-auth";
import { createAuditLog } from "@/lib/audit";
import type { ActionResult } from "@/actions/society";

const updateContactSchema = z
  .object({
    email: z.string().email("Email invalide").optional(),
    phone: z.string().min(1).optional(),
    mobile: z.string().min(1).optional(),
  })
  .refine((d) => d.email || d.phone || d.mobile, {
    message: "Au moins un champ (email, téléphone ou mobile) est requis",
  });

export async function updatePortalTenantContact(
  input: { email?: string; phone?: string; mobile?: string }
): Promise<ActionResult<void>> {
  try {
    const session = await requirePortalAuth();

    const parsed = updateContactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true, societyId: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    // Ne pas modifier l'email de connexion au portail (evite de se verrouiller dehors)
    const { email: _ignored, ...safeData } = parsed.data;
    void _ignored;

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: safeData,
    });

    await createAuditLog({
      societyId: tenant.societyId,
      userId: tenant.id,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: { source: "portal", fields: Object.keys(safeData) },
    });

    return { success: true };
  } catch (error) {
    console.error("[updatePortalTenantContact]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}
