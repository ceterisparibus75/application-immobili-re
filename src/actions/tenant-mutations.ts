"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { randomInt, randomUUID } from "crypto";
import { sendPortalActivationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type UpdateTenantInput,
} from "@/validations/tenant";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  tenantContactSchema,
  tenantBalanceAdjustmentSchema,
  tenantLedgerImportSchema,
  type TenantContactInput,
} from "@/actions/tenant-shared";

export async function createTenant(
  societyId: string,
  input: CreateTenantInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

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
      userId: context.userId,
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
      portalUrl: env.AUTH_URL,
    }).catch((err) => console.error("[createTenant] portal email error", err));

    return { success: true, data: { id: tenant.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateTenantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, birthDate, ...data } = parsed.data;

    const existing = await prisma.tenant.findFirst({
      where: { id, societyId, deletedAt: null },
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
      userId: context.userId,
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
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const activeLeases = await prisma.lease.count({
      where: { societyId, tenantId, status: "EN_COURS", deletedAt: null },
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
      userId: context.userId,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenantId,
      details: { isActive: false },
    });

    revalidatePath("/locataires");
    revalidatePath("/contacts");
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[deactivateTenant]", error);
    return { success: false, error: "Erreur lors de la désactivation" };
  }
}

export async function createTenantContact(
  societyId: string,
  tenantId: string,
  input: TenantContactInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = tenantContactSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, societyId, deletedAt: null } });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const contact = await prisma.tenantContact.create({
      data: { tenantId, ...parsed.data },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "TenantContact",
      entityId: contact.id,
      details: { tenantId, name: contact.name },
    });

    revalidatePath(`/locataires/${tenantId}`);
    return { success: true, data: { id: contact.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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
      userId: context.userId,
      action: "UPDATE",
      entity: "TenantContact",
      entityId: contactId,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath(`/locataires/${existing.tenantId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId, deletedAt: null },
      include: { leases: { where: { status: "EN_COURS", deletedAt: null } } },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    if (tenant.leases.length > 0) {
      return { success: false, error: "Impossible de supprimer un locataire ayant un bail actif. Résiliez d'abord ses baux." };
    }

    // Les factures comptables restent conservees ; l'action archive le locataire.
    const accountingInvoices = await prisma.invoice.count({
      where: { tenantId, status: { not: "BROUILLON" } },
    });

    await prisma.$transaction([
      prisma.tenantPortalAccess.updateMany({ where: { tenantId }, data: { isActive: false } }),
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: false,
          deletedAt: new Date(),
          deletedBy: context.userId,
          archivedReason: accountingInvoices > 0
            ? `Archivage avec ${accountingInvoices} facture(s) comptable(s) conservée(s)`
            : "Suppression utilisateur",
        },
      }),
    ]);

    await createAuditLog({
      societyId,
      userId: context.userId,
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
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const existing = await prisma.tenantContact.findFirst({
      where: { id: contactId, tenant: { societyId } },
    });
    if (!existing) return { success: false, error: "Contact introuvable" };

    await prisma.tenantContact.delete({ where: { id: contactId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "TenantContact",
      entityId: contactId,
      details: { tenantId: existing.tenantId },
    });

    revalidatePath(`/locataires/${existing.tenantId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, societyId, deletedAt: null },
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
      portalUrl: env.AUTH_URL,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "SEND_EMAIL",
      entity: "Tenant",
      entityId: tenantId,
      details: { action: "portal_invitation" },
    });

    revalidatePath(`/locataires/${tenantId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[inviteOrReinviteTenant]", error);
    return { success: false, error: "Erreur lors de l'envoi de l'invitation" };
  }
}

// ============================================================
// MIGRATION : Synchroniser les locataires existants vers Contacts
// ============================================================

export async function syncTenantsToContacts(
  societyId: string
): Promise<ActionResult<{ created: number; updated: number }>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    // Récupérer tous les locataires de la société
    const tenants = await prisma.tenant.findMany({
      where: { societyId, deletedAt: null },
      include: { contact: true },
    });

    let created = 0;
    let updated = 0;

    for (const tenant of tenants) {
      const name =
        tenant.entityType === "PERSONNE_MORALE"
          ? (tenant.companyName ?? "—")
          : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "—";

      const contactData = {
        contactType: "LOCATAIRE" as const,
        name,
        company: tenant.entityType === "PERSONNE_MORALE" ? (tenant.legalRepName ?? null) : null,
        email: tenant.email,
        phone: tenant.phone ?? null,
        mobile: tenant.mobile ?? null,
        isActive: tenant.isActive,
      };

      if (!tenant.contact) {
        // Pas de fiche Contact associée → en créer une
        await prisma.contact.create({
          data: {
            societyId,
            tenantId: tenant.id,
            ...contactData,
          },
        });
        created++;
      } else {
        // Fiche Contact existante → mettre à jour
        await prisma.contact.update({
          where: { id: tenant.contact.id },
          data: contactData,
        });
        updated++;
      }
    }

    revalidatePath("/contacts");
    revalidatePath("/locataires");

    return { success: true, data: { created, updated } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[syncTenantsToContacts]", error);
    return { success: false, error: "Erreur lors de la synchronisation" };
  }
}

export async function createTenantBalanceAdjustment(
  societyId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = tenantBalanceAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.data.tenantId, societyId, deletedAt: null },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    // Trouver le bail actif si existant
    const activeLease = await prisma.lease.findFirst({
      where: { societyId, tenantId: parsed.data.tenantId, status: "EN_COURS", deletedAt: null },
      select: { id: true },
    });

    const amount = parsed.data.vatRate === undefined
      ? parsed.data.amount
      : parsed.data.amount * (1 + parsed.data.vatRate / 100);

    const adjustment = await prisma.tenantBalanceAdjustment.create({
      data: {
        societyId,
        tenantId: parsed.data.tenantId,
        leaseId: activeLease?.id ?? null,
        label: parsed.data.label,
        amount: Math.round(amount * 100) / 100,
        dueDate: new Date(parsed.data.dueDate),
        notes: parsed.data.notes || null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "TenantBalanceAdjustment",
      entityId: adjustment.id,
      details: {
        type: "OPENING_BALANCE_IMPORT",
        tenantId: parsed.data.tenantId,
        label: parsed.data.label,
        amount: adjustment.amount,
      },
    });

    revalidatePath(`/locataires/${parsed.data.tenantId}`);
    revalidatePath("/facturation");

    return { success: true, data: { id: adjustment.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createTenantBalanceAdjustment]", error);
    return { success: false, error: "Erreur lors de l'import du solde précédent" };
  }
}

/**
 * Importe un relevé locataire historique exporté d'un ancien logiciel.
 * Les lignes restent hors facture et ne génèrent aucun numéro.
 */
export async function importTenantLedgerStatement(
  societyId: string,
  input: unknown
): Promise<ActionResult<{ imported: number; batchId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = tenantLedgerImportSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.data.tenantId, societyId, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    let leaseId = parsed.data.leaseId ?? null;
    if (leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, societyId, tenantId: parsed.data.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!lease) return { success: false, error: "Bail introuvable pour ce locataire" };
    } else {
      const activeLease = await prisma.lease.findFirst({
        where: { societyId, tenantId: parsed.data.tenantId, status: "EN_COURS", deletedAt: null },
        select: { id: true },
      });
      leaseId = activeLease?.id ?? null;
    }

    const batchId = randomUUID();
    const rows = parsed.data.lines.map((line) => {
      const amount = Math.round((line.debit - line.credit) * 100) / 100;
      return {
        societyId,
        tenantId: parsed.data.tenantId,
        leaseId,
        label: line.label,
        amount,
        dueDate: new Date(line.date),
        notes: null,
        reference: line.reference || null,
        periodLabel: line.periodLabel || null,
        periodStart: line.periodStart ? new Date(line.periodStart) : null,
        periodEnd: line.periodEnd ? new Date(line.periodEnd) : null,
        balanceAfter: line.balanceAfter ?? null,
        source: "LEDGER_IMPORT",
        importBatchId: batchId,
      };
    }).filter((line) => line.amount !== 0);

    if (rows.length === 0) return { success: false, error: "Aucune ligne avec débit ou crédit à importer" };

    await prisma.tenantBalanceAdjustment.createMany({ data: rows });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "TenantBalanceAdjustment",
      entityId: batchId,
      details: {
        type: "TENANT_LEDGER_IMPORT",
        tenantId: parsed.data.tenantId,
        imported: rows.length,
        batchId,
      },
    });

    revalidatePath(`/locataires/${parsed.data.tenantId}`);
    revalidatePath("/facturation");

    return { success: true, data: { imported: rows.length, batchId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[importTenantLedgerStatement]", error);
    return { success: false, error: "Erreur lors de l'import du relevé locataire" };
  }
}

export async function createManualDebit(
  societyId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return createTenantBalanceAdjustment(societyId, input);
}
