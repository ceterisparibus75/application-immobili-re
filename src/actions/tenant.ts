"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type UpdateTenantInput,
} from "@/validations/tenant";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { randomInt } from "crypto";
import { sendPortalActivationEmail } from "@/lib/email";

const tenantContactSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  role: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable(),
  phone: z.string().optional().nullable(),
});

type TenantContactInput = z.infer<typeof tenantContactSchema>;

export async function createTenant(
  societyId: string,
  input: CreateTenantInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createTenantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    const tenant = await prisma.tenant.create({
      data: {
        societyId,
        entityType: data.entityType,
        email: data.email,
        billingEmail: data.billingEmail ?? null,
        phone: data.phone ?? null,
        mobile: data.mobile ?? null,
        riskIndicator: data.riskIndicator,
        notes: data.notes ?? null,
        ...(data.entityType === "PERSONNE_MORALE"
          ? {
              companyName: data.companyName,
              companyLegalForm: data.companyLegalForm ?? null,
              siret: data.siret ?? null,
              siren: data.siren ?? null,
              codeAPE: data.codeAPE ?? null,
              vatNumber: data.vatNumber ?? null,
              companyAddress: data.companyAddress ?? null,
              shareCapital: data.shareCapital ?? null,
              legalRepName: data.legalRepName ?? null,
              legalRepTitle: data.legalRepTitle ?? null,
              legalRepEmail: data.legalRepEmail ?? null,
              legalRepPhone: data.legalRepPhone ?? null,
            }
          : {
              lastName: data.lastName,
              firstName: data.firstName,
              birthDate: data.birthDate ? new Date(data.birthDate) : null,
              birthPlace: data.birthPlace ?? null,
              personalAddress: data.personalAddress ?? null,
              autoEntrepreneurSiret: data.autoEntrepreneurSiret ?? null,
            }),
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: {
        entityType: tenant.entityType,
        name:
          tenant.entityType === "PERSONNE_MORALE"
            ? tenant.companyName
            : `${tenant.firstName} ${tenant.lastName}`,
      },
    });

    // Créer automatiquement la fiche contact
    await prisma.contact.create({
      data: {
        societyId,
        tenantId: tenant.id,
        contactType: "LOCATAIRE",
        name:
          tenant.entityType === "PERSONNE_MORALE"
            ? (tenant.companyName ?? "—")
            : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—",
        company: tenant.entityType === "PERSONNE_MORALE" ? (tenant.legalRepName ?? null) : null,
        email: tenant.email,
        phone: tenant.phone ?? null,
        mobile: tenant.mobile ?? null,
      },
    });

    revalidatePath("/locataires");
    revalidatePath("/contacts");

    // Créer l'accès portail et envoyer l'invitation
    const activationCode = String(randomInt(100000, 999999));
    const hashedCode = await hash(activationCode, 10);
    const token = crypto.randomUUID();

    await prisma.tenantPortalAccess.create({
      data: {
        tenantId: tenant.id,
        token,
        isActive: false,
        activationCode: hashedCode,
        activationCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

    await sendPortalActivationEmail({
      to: tenant.email,
      tenantName,
      activationCode,
      portalUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    }).catch((err) => console.error("[createTenant] portal email error", err));

    return { success: true, data: { id: tenant.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[createTenant]", error);
    return { success: false, error: "Erreur lors de la création du locataire" };
  }
}

export async function updateTenant(
  societyId: string,
  input: UpdateTenantInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateTenantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, birthDate, ...data } = parsed.data;

    const existing = await prisma.tenant.findFirst({
      where: { id, societyId },
    });
    if (!existing) {
      return { success: false, error: "Locataire introuvable" };
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      updateData[key] = value === "" ? null : value;
    }
    if (birthDate !== undefined) {
      updateData.birthDate = birthDate ? new Date(birthDate) : null;
    }

    await prisma.tenant.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Tenant",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    // Synchroniser la fiche contact si elle existe
    const updated = await prisma.tenant.findUnique({ where: { id } });
    if (updated) {
      await prisma.contact.updateMany({
        where: { tenantId: id },
        data: {
          name:
            updated.entityType === "PERSONNE_MORALE"
              ? (updated.companyName ?? "—")
              : `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim() || "—",
          company: updated.entityType === "PERSONNE_MORALE" ? (updated.legalRepName ?? null) : null,
          email: updated.email,
          phone: updated.phone ?? null,
          mobile: updated.mobile ?? null,
        },
      });
    }

    revalidatePath("/locataires");
    revalidatePath(`/locataires/${id}`);
    revalidatePath("/contacts");

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateTenant]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deactivateTenant(
  societyId: string,
  tenantId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const activeLeases = await prisma.lease.count({
      where: { societyId, tenantId, status: "EN_COURS" },
    });
    if (activeLeases > 0) {
      return {
        success: false,
        error: `Impossible : ${activeLeases} bail(aux) actif(s) pour ce locataire`,
      };
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: false },
    });

    // Désactiver la fiche contact associée
    await prisma.contact.updateMany({
      where: { tenantId },
      data: { isActive: false },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenantId,
      details: { isActive: false },
    });

    revalidatePath("/locataires");
    revalidatePath("/contacts");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deactivateTenant]", error);
    return { success: false, error: "Erreur lors de la désactivation" };
  }
}

export async function getTenants(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.tenant.findMany({
    where: { societyId },
    include: {
      _count: { select: { leases: true } },
      leases: {
        where: { status: "EN_COURS" },
        select: {
          id: true,
          currentRentHT: true,
          startDate: true,
          lot: {
            select: {
              number: true,
              building: { select: { name: true } },
            },
          },
        },
        orderBy: { startDate: "desc" },
        take: 3,
      },
    },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
  });
}

export async function getActiveTenants(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.tenant.findMany({
    where: { societyId, isActive: true },
    select: {
      id: true,
      entityType: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
  });
}

export async function getTenantById(societyId: string, tenantId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.tenant.findFirst({
    where: { id: tenantId, societyId },
    include: {
      leases: {
        include: {
          lot: {
            include: { building: { select: { id: true, name: true, city: true } } },
          },
        },
        orderBy: { startDate: "desc" },
      },
      guarantees: true,
      documentChecklist: true,
      secondaryContacts: { orderBy: { name: "asc" } },
      _count: { select: { leases: true } },
    },
  });
}

export async function createTenantContact(
  societyId: string,
  tenantId: string,
  input: TenantContactInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = tenantContactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, societyId } });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const contact = await prisma.tenantContact.create({
      data: { tenantId, ...parsed.data },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "TenantContact",
      entityId: contact.id,
      details: { tenantId, name: contact.name },
    });

    revalidatePath(`/locataires/${tenantId}`);
    return { success: true, data: { id: contact.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createTenantContact]", error);
    return { success: false, error: "Erreur lors de la création du contact" };
  }
}

export async function updateTenantContact(
  societyId: string,
  contactId: string,
  input: TenantContactInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = tenantContactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const existing = await prisma.tenantContact.findFirst({
      where: { id: contactId, tenant: { societyId } },
    });
    if (!existing) return { success: false, error: "Contact introuvable" };

    await prisma.tenantContact.update({ where: { id: contactId }, data: parsed.data });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "TenantContact",
      entityId: contactId,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath(`/locataires/${existing.tenantId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateTenantContact]", error);
    return { success: false, error: "Erreur lors de la mise à jour du contact" };
  }
}

export async function deleteTenant(
  societyId: string,
  tenantId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId },
      include: { leases: { where: { status: "EN_COURS" } } },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    if (tenant.leases.length > 0) {
      return { success: false, error: "Impossible de supprimer un locataire ayant un bail actif. Résiliez d'abord ses baux." };
    }

    // Supprimer les relations puis le locataire en transaction
    await prisma.$transaction([
      prisma.tenantContact.deleteMany({ where: { tenantId } }),
      prisma.tenantDocument.deleteMany({ where: { tenantId } }),
      prisma.guarantee.deleteMany({ where: { tenantId } }),
      prisma.tenantPortalAccess.deleteMany({ where: { tenantId } }),
      prisma.invoice.deleteMany({ where: { tenantId } }),
      prisma.document.updateMany({ where: { tenantId }, data: { tenantId: null } }),
      prisma.tenant.delete({ where: { id: tenantId } }),
    ]);

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Tenant",
      entityId: tenantId,
      details: {
        name: tenant.companyName ?? `${tenant.firstName} ${tenant.lastName}`,
      },
    });

    revalidatePath("/locataires");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteTenant]", error);
    return { success: false, error: "Erreur lors de la suppression du locataire" };
  }
}

export async function deleteTenantContact(
  societyId: string,
  contactId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const existing = await prisma.tenantContact.findFirst({
      where: { id: contactId, tenant: { societyId } },
    });
    if (!existing) return { success: false, error: "Contact introuvable" };

    await prisma.tenantContact.delete({ where: { id: contactId } });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "TenantContact",
      entityId: contactId,
      details: { tenantId: existing.tenantId },
    });

    revalidatePath(`/locataires/${existing.tenantId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteTenantContact]", error);
    return { success: false, error: "Erreur lors de la suppression du contact" };
  }
}

export async function inviteOrReinviteTenant(
  societyId: string,
  tenantId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const activationCode = String(randomInt(100000, 999999));
    const hashedCode = await hash(activationCode, 10);
    const token = crypto.randomUUID();

    await prisma.tenantPortalAccess.upsert({
      where: { tenantId },
      create: {
        tenantId,
        token,
        isActive: false,
        activationCode: hashedCode,
        activationCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      update: {
        activationCode: hashedCode,
        activationCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        invitedAt: new Date(),
      },
    });

    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim();

    await sendPortalActivationEmail({
      to: tenant.email,
      tenantName,
      activationCode,
      portalUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "SEND_EMAIL",
      entity: "Tenant",
      entityId: tenantId,
      details: { action: "portal_invitation" },
    });

    revalidatePath(`/locataires/${tenantId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[inviteOrReinviteTenant]", error);
    return { success: false, error: "Erreur lors de l'envoi de l'invitation" };
  }
}
