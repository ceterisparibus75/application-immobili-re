"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePortalAuth } from "@/lib/portal-auth";
import { createAuditLog } from "@/lib/audit";
import type { ActionResult } from "@/actions/society";

const updateContactSchema = z
  .object({
    phone: z.string().min(1).optional(),
    mobile: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
  })
  .refine((d) => d.phone || d.mobile || d.address, {
    message: "Au moins un champ est requis",
  });

export async function updatePortalTenantContact(
  input: { phone?: string; mobile?: string; address?: string }
): Promise<ActionResult<void>> {
  try {
    const session = await requirePortalAuth();

    const parsed = updateContactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
      select: { id: true, societyId: true, entityType: true, phone: true, mobile: true, personalAddress: true, companyAddress: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const addressField = tenant.entityType === "PERSONNE_MORALE" ? "companyAddress" : "personalAddress";
    const currentAddress = tenant[addressField] ?? null;

    const updateData: Record<string, string> = {};
    if (parsed.data.phone) updateData.phone = parsed.data.phone;
    if (parsed.data.mobile) updateData.mobile = parsed.data.mobile;
    if (parsed.data.address) updateData[addressField] = parsed.data.address;

    // Captures avant/apres pour justification bailleur
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    if (parsed.data.phone) { before.phone = tenant.phone ?? null; after.phone = parsed.data.phone; }
    if (parsed.data.mobile) { before.mobile = tenant.mobile ?? null; after.mobile = parsed.data.mobile; }
    if (parsed.data.address) { before.address = currentAddress; after.address = parsed.data.address; }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: updateData,
    });

    await createAuditLog({
      societyId: tenant.societyId,
      userId: tenant.id,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: {
        event: "PORTAL_TENANT_CONTACT_UPDATE",
        source: "portal_locataire",
        tenantEmail: session.email,
        before,
        after,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[updatePortalTenantContact]", error);
    return { success: false, error: "Erreur lors de la mise a jour" };
  }
}
