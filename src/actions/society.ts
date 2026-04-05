"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSocietyLimit } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createSocietySchema,
  updateSocietySchema,
  type CreateSocietyInput,
  type UpdateSocietyInput,
} from "@/validations/society";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function createSociety(
  input: CreateSocietyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = createSocietySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier la limite de sociétés du plan
    const socLimit = await checkSocietyLimit(session.user.id);
    if (!socLimit.allowed) return { success: false, error: socLimit.message };

    // Vérifier que le SIRET n'existe pas déjà
    const existing = await prisma.society.findUnique({
      where: { siret: data.siret },
    });
    if (existing) {
      return { success: false, error: "Ce SIRET est déjà enregistré" };
    }

    // Chiffrer les données bancaires si fournies
    const ibanEncrypted = data.iban ? encrypt(data.iban) : null;
    const bicEncrypted = data.bic ? encrypt(data.bic) : null;

    const society = await prisma.society.create({
      data: {
        name: data.name,
        legalForm: data.legalForm,
        siret: data.siret,
        vatNumber: data.vatNumber || null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        taxRegime: data.taxRegime,
        vatRegime: data.vatRegime,
        ibanEncrypted,
        bicEncrypted,
        bankName: data.bankName || null,
        accountantName: data.accountantName || null,
        accountantFirm: data.accountantFirm || null,
        accountantEmail: data.accountantEmail || null,
        accountantPhone: data.accountantPhone || null,
        invoicePrefix: data.invoicePrefix || null,
        legalMentions: data.legalMentions || null,
        phone: data.phone || null,
        shareCapital: data.shareCapital ?? null,
        signatoryName: data.signatoryName || null,
        ownerId: session.user.id,
        proprietaireId: data.proprietaireId || null,
      },
    });

    // Assigner le créateur comme ADMIN_SOCIETE
    await prisma.userSociety.create({
      data: {
        userId: session.user.id,
        societyId: society.id,
        role: "ADMIN_SOCIETE",
      },
    });

    // Créer un abonnement d'essai implicite (14 jours)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await prisma.subscription.create({
      data: {
        societyId: society.id,
        planId: "STARTER",
        status: "TRIALING",
        trialStart: new Date(),
        trialEnd,
      },
    });

    await createAuditLog({
      societyId: society.id,
      userId: session.user.id,
      action: "CREATE",
      entity: "Society",
      entityId: society.id,
      details: { name: society.name, siret: society.siret },
    });

    revalidatePath("/", "layout");
    revalidatePath("/societes");
    revalidatePath("/dashboard");

    return { success: true, data: { id: society.id } };
  } catch (error) {
    console.error("[createSociety]", error);
    return { success: false, error: "Erreur lors de la création de la société" };
  }
}

export async function updateSociety(
  input: UpdateSocietyInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    const parsed = updateSocietySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, iban, bic, ...data } = parsed.data;

    await requireSocietyAccess(session.user.id, id, "ADMIN_SOCIETE");

    const updateData: Record<string, unknown> = { ...data };

    // Ne chiffrer que si la valeur a changé
    if (iban !== undefined) {
      updateData.ibanEncrypted = iban ? encrypt(iban) : null;
    }
    if (bic !== undefined) {
      updateData.bicEncrypted = bic ? encrypt(bic) : null;
    }
    // Retirer les champs non-Prisma
    delete updateData.iban;
    delete updateData.bic;

    // Nettoyer les chaînes vides en null
    for (const key of Object.keys(updateData)) {
      if (updateData[key] === "") {
        updateData[key] = null;
      }
    }

    await prisma.society.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      societyId: id,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Society",
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    revalidatePath("/societes");
    revalidatePath(`/societes/${id}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateSociety]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function getSocieties() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const memberships = await prisma.userSociety.findMany({
    where: { userId: session.user.id },
    include: {
      society: {
        select: {
          id: true,
          name: true,
          legalForm: true,
          siret: true,
          city: true,
          isActive: true,
          logoUrl: true,
          ownerId: true,
        },
      },
    },
    orderBy: { society: { name: "asc" } },
  });

  const membershipIds = new Set(memberships.map((m) => m.societyId));

  // Include societies owned by user but without explicit membership
  const ownedWithoutMembership = await prisma.society.findMany({
    where: { ownerId: session.user.id, id: { notIn: Array.from(membershipIds) } },
    select: { id: true, name: true, legalForm: true, siret: true, city: true, isActive: true, logoUrl: true, ownerId: true },
    orderBy: { name: "asc" },
  });

  const fromMemberships = memberships.map((m) => ({
    ...m.society,
    role: m.role,
  }));

  const fromOwned = ownedWithoutMembership.map((s) => ({
    ...s,
    role: "ADMIN_SOCIETE" as const,
  }));

  return [...fromMemberships, ...fromOwned];
}

export async function getSocietyById(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, id);

  return prisma.society.findUnique({
    where: { id },
    include: {
      buildings: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          city: true,
          buildingType: true,
          _count: { select: { lots: true } },
        },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          buildings: true,
          leases: true,
          tenants: true,
          invoices: true,
        },
      },
    },
  });
}

export async function deleteSociety(id: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, id, "SUPER_ADMIN");

    // Vérifier qu'il n'y a pas de baux actifs
    const activeLeases = await prisma.lease.count({
      where: { societyId: id, status: "EN_COURS" },
    });
    if (activeLeases > 0) {
      return {
        success: false,
        error: `Impossible de supprimer : ${activeLeases} bail(aux) actif(s)`,
      };
    }

    // Soft delete : désactiver plutôt que supprimer
    await prisma.society.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      societyId: id,
      userId: session.user.id,
      action: "DELETE",
      entity: "Society",
      entityId: id,
    });

    revalidatePath("/societes");
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deleteSociety]", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
