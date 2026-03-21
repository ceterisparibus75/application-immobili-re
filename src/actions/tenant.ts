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

    revalidatePath("/locataires");

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

    revalidatePath("/locataires");
    revalidatePath(`/locataires/${id}`);

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

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenantId,
      details: { isActive: false },
    });

    revalidatePath("/locataires");
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
      _count: { select: { leases: true } },
    },
  });
}
