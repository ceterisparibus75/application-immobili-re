"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

/**
 * Mandataires du locataire (comptables, gérants, assistants…) qui peuvent :
 *  - se connecter au portail au nom du locataire (canAccessPortal)
 *  - recevoir sélectivement les factures, quittances, relances, documents
 *
 * Un même comptable peut être mandataire de plusieurs locataires — c'est
 * l'email qui l'identifie côté auth portail (lookup dans Tenant.email,
 * Tenant.billingEmail OU TenantMandataire.email).
 */

const upsertSchema = z.object({
  email: z.string().email("Email invalide").max(254),
  name: z.string().max(120).optional().nullable(),
  role: z.string().max(80).optional().nullable(),
  canAccessPortal: z.boolean().default(true),
  receivesInvoices: z.boolean().default(true),
  receivesQuittances: z.boolean().default(true),
  receivesReminders: z.boolean().default(true),
  receivesDocuments: z.boolean().default(true),
});

export type MandataireInput = z.infer<typeof upsertSchema>;

async function ensureTenantAccess(societyId: string, tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, societyId, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) throw new ForbiddenError("Locataire introuvable");
}

export async function listTenantMandataires(
  societyId: string,
  tenantId: string
): Promise<ActionResult<Array<{
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  canAccessPortal: boolean;
  receivesInvoices: boolean;
  receivesQuittances: boolean;
  receivesReminders: boolean;
  receivesDocuments: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}>>> {
  try {
    await requireSocietyActionContext(societyId, "LECTURE");
    await ensureTenantAccess(societyId, tenantId);

    const items = await prisma.tenantMandataire.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }],
    });

    return {
      success: true,
      data: items.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        canAccessPortal: m.canAccessPortal,
        receivesInvoices: m.receivesInvoices,
        receivesQuittances: m.receivesQuittances,
        receivesReminders: m.receivesReminders,
        receivesDocuments: m.receivesDocuments,
        lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[listTenantMandataires]", error);
    return { success: false, error: "Erreur lors du chargement des mandataires" };
  }
}

export async function addTenantMandataire(
  societyId: string,
  tenantId: string,
  input: MandataireInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");
    await ensureTenantAccess(societyId, tenantId);

    const parsed = upsertSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const data = parsed.data;

    // Contrainte unique tenantId+email : detecter préemptivement pour un
    // message d'erreur plus clair.
    const existing = await prisma.tenantMandataire.findFirst({
      where: { tenantId, email: data.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Un mandataire avec cette adresse email existe déjà pour ce locataire" };
    }

    const created = await prisma.tenantMandataire.create({
      data: {
        tenantId,
        email: data.email.toLowerCase().trim(),
        name: data.name?.trim() || null,
        role: data.role?.trim() || null,
        canAccessPortal: data.canAccessPortal,
        receivesInvoices: data.receivesInvoices,
        receivesQuittances: data.receivesQuittances,
        receivesReminders: data.receivesReminders,
        receivesDocuments: data.receivesDocuments,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "TenantMandataire",
      entityId: created.id,
      details: { tenantId, email: created.email },
    });

    revalidatePath(`/locataires/${tenantId}`);
    revalidatePath(`/locataires/${tenantId}/modifier`);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[addTenantMandataire]", error);
    return { success: false, error: "Erreur lors de l'ajout du mandataire" };
  }
}

export async function updateTenantMandataire(
  societyId: string,
  mandataireId: string,
  input: Partial<MandataireInput>
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const mandataire = await prisma.tenantMandataire.findFirst({
      where: { id: mandataireId, tenant: { societyId, deletedAt: null } },
      select: { id: true, tenantId: true },
    });
    if (!mandataire) return { success: false, error: "Mandataire introuvable" };

    const parsed = upsertSchema.partial().safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }
    const data = parsed.data;

    await prisma.tenantMandataire.update({
      where: { id: mandataireId },
      data: {
        ...(data.email !== undefined ? { email: data.email.toLowerCase().trim() } : {}),
        ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
        ...(data.role !== undefined ? { role: data.role?.trim() || null } : {}),
        ...(data.canAccessPortal !== undefined ? { canAccessPortal: data.canAccessPortal } : {}),
        ...(data.receivesInvoices !== undefined ? { receivesInvoices: data.receivesInvoices } : {}),
        ...(data.receivesQuittances !== undefined ? { receivesQuittances: data.receivesQuittances } : {}),
        ...(data.receivesReminders !== undefined ? { receivesReminders: data.receivesReminders } : {}),
        ...(data.receivesDocuments !== undefined ? { receivesDocuments: data.receivesDocuments } : {}),
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "TenantMandataire",
      entityId: mandataireId,
      details: { tenantId: mandataire.tenantId, updated: Object.keys(data) },
    });

    revalidatePath(`/locataires/${mandataire.tenantId}`);
    revalidatePath(`/locataires/${mandataire.tenantId}/modifier`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateTenantMandataire]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function removeTenantMandataire(
  societyId: string,
  mandataireId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const mandataire = await prisma.tenantMandataire.findFirst({
      where: { id: mandataireId, tenant: { societyId, deletedAt: null } },
      select: { id: true, tenantId: true, email: true },
    });
    if (!mandataire) return { success: false, error: "Mandataire introuvable" };

    await prisma.tenantMandataire.delete({ where: { id: mandataireId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "TenantMandataire",
      entityId: mandataireId,
      details: { tenantId: mandataire.tenantId, email: mandataire.email },
    });

    revalidatePath(`/locataires/${mandataire.tenantId}`);
    revalidatePath(`/locataires/${mandataire.tenantId}/modifier`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[removeTenantMandataire]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
