"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createLeaseSchema,
  updateLeaseSchema,
  type CreateLeaseInput,
  type UpdateLeaseInput,
} from "@/validations/lease";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";

export async function createLease(
  societyId: string,
  input: CreateLeaseInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = createLeaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const data = parsed.data;

    // Vérifier que le lot et le locataire appartiennent à la société
    const [lot, tenant] = await Promise.all([
      prisma.lot.findFirst({ where: { id: data.lotId, building: { societyId } } }),
      prisma.tenant.findFirst({ where: { id: data.tenantId, societyId, isActive: true } }),
    ]);

    if (!lot) return { success: false, error: "Lot introuvable" };
    if (!tenant) return { success: false, error: "Locataire introuvable ou inactif" };

    // Vérifier qu'il n'y a pas déjà un bail actif sur ce lot
    const existingActiveLease = await prisma.lease.findFirst({
      where: { societyId, lotId: data.lotId, status: "EN_COURS" },
    });
    if (existingActiveLease) {
      return {
        success: false,
        error: "Ce lot a déjà un bail actif. Résiliez-le avant d'en créer un nouveau.",
      };
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + data.durationMonths);

    // Generer le numero de bail incrementale
    const leaseNumber = await generateLeaseNumber(societyId);

    const lease = await prisma.lease.create({
      data: {
        societyId,
        lotId: data.lotId,
        tenantId: data.tenantId,
        leaseNumber,
        leaseTemplateId: data.leaseTemplateId ?? null,
        leaseType: data.leaseType,
        status: "EN_COURS",
        startDate,
        durationMonths: data.durationMonths,
        endDate,
        baseRentHT: data.baseRentHT,
        currentRentHT: data.baseRentHT,
        depositAmount: data.depositAmount,
        paymentFrequency: data.paymentFrequency,
        billingTerm: data.billingTerm ?? "A_ECHOIR",
        vatApplicable: data.vatApplicable,
        vatRate: data.vatRate,
        indexType: data.indexType ?? null,
        baseIndexValue: data.baseIndexValue ?? null,
        baseIndexQuarter: data.baseIndexQuarter ?? null,
        revisionFrequency: data.revisionFrequency,
        revisionDateBasis: data.revisionDateBasis ?? "DATE_SIGNATURE",
        revisionCustomMonth: data.revisionCustomMonth ?? null,
        revisionCustomDay: data.revisionCustomDay ?? null,
        rentFreeMonths: data.rentFreeMonths,
        entryFee: data.entryFee,
        tenantWorksClauses: data.tenantWorksClauses ?? null,
        isThirdPartyManaged: data.isThirdPartyManaged ?? false,
        managingContactId: data.managingContactId ?? null,
        managementFeeType: data.managementFeeType ?? null,
        managementFeeValue: data.managementFeeValue ?? null,
        managementFeeBasis: data.managementFeeBasis ?? null,
        managementFeeVatRate: data.managementFeeVatRate ?? null,
      },
    });

    // Mettre à jour le statut du lot
    await prisma.lot.update({
      where: { id: data.lotId },
      data: { status: "OCCUPE", currentRent: data.baseRentHT },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Lease",
      entityId: lease.id,
      details: {
        lotId: data.lotId,
        tenantId: data.tenantId,
        baseRentHT: data.baseRentHT,
        startDate: data.startDate,
      },
    });

    revalidatePath("/baux");
    revalidatePath(`/patrimoine/immeubles/${lot.buildingId}`);
    revalidatePath(`/locataires/${data.tenantId}`);

    return { success: true, data: { id: lease.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[createLease]", error);
    return { success: false, error: "Erreur lors de la création du bail" };
  }
}

export async function updateLease(
  societyId: string,
  input: UpdateLeaseInput
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = updateLeaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, entryDate, exitDate, startDate, endDate, ...data } = parsed.data;

    const existing = await prisma.lease.findFirst({
      where: { id, societyId },
    });
    if (!existing) return { success: false, error: "Bail introuvable" };

    const updateData: Record<string, unknown> = { ...data };
    if (entryDate !== undefined) updateData.entryDate = entryDate ? new Date(entryDate) : null;
    if (exitDate !== undefined) updateData.exitDate = exitDate ? new Date(exitDate) : null;
    if (startDate !== undefined && startDate) updateData.startDate = new Date(startDate);
    if (endDate !== undefined && endDate) updateData.endDate = new Date(endDate);

    // Si résiliation : mettre à jour le lot
    if (data.status === "RESILIE" && existing.status !== "RESILIE") {
      updateData.exitDate = updateData.exitDate ?? new Date();
      await prisma.lot.update({
        where: { id: existing.lotId },
        data: { status: "VACANT", currentRent: null },
      });
    }

    await prisma.lease.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Lease",
      entityId: id,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${id}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateLease]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function deleteLease(
  societyId: string,
  leaseId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "ADMIN_SOCIETE");

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
      select: { id: true, status: true, lotId: true },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    if (lease.status === "EN_COURS") {
      return {
        success: false,
        error: "Impossible de supprimer un bail en cours. Résiliez-le d'abord.",
      };
    }

    await prisma.lease.delete({ where: { id: leaseId } });

    // Remettre le lot en vacant si plus aucun bail actif
    const remainingActive = await prisma.lease.count({
      where: { lotId: lease.lotId, status: "EN_COURS" },
    });
    if (remainingActive === 0) {
      await prisma.lot.update({
        where: { id: lease.lotId },
        data: { status: "VACANT" },
      });
    }

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "Lease",
      entityId: leaseId,
    });

    revalidatePath("/baux");
    revalidatePath(`/patrimoine/immeubles`);
    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteLease]", error);
    return { success: false, error: "Erreur lors de la suppression du bail" };
  }
}

export async function getLeases(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.lease.findMany({
    where: { societyId },
    include: {
      lot: {
        include: {
          building: { select: { id: true, name: true, addressLine1: true, postalCode: true, city: true } },
        },
      },
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      rentRevisions: {
        where: { isValidated: true },
        orderBy: { effectiveDate: "desc" },
        take: 1,
        select: { effectiveDate: true },
      },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
}

/**
 * Genere un numero de bail incrementale pour une societe.
 * Format: {PREFIX}-{ANNEE}-{NUMERO} (ex: BAIL-2026-0001)
 */
async function generateLeaseNumber(societyId: string): Promise<string> {
  const currentYear = new Date().getFullYear();

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { leasePrefix: true, nextLeaseNumber: true, leaseNumberYear: true },
  });

  const prefix = society?.leasePrefix || "BAIL";
  let nextNumber = (society?.nextLeaseNumber ?? 0) + 1;

  // Reset compteur si nouvelle annee
  if (society?.leaseNumberYear !== currentYear) {
    nextNumber = 1;
  }

  await prisma.society.update({
    where: { id: societyId },
    data: {
      nextLeaseNumber: nextNumber,
      leaseNumberYear: currentYear,
    },
  });

  const paddedNumber = String(nextNumber).padStart(4, "0");
  return `${prefix}-${currentYear}-${paddedNumber}`;
}

export async function getLeaseById(societyId: string, leaseId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.lease.findFirst({
    where: { id: leaseId, societyId },
    include: {
      lot: {
        include: {
          building: {
            select: { id: true, name: true, city: true, postalCode: true },
          },
        },
      },
      tenant: true,
      managingContact: {
        select: { id: true, name: true, company: true, email: true, phone: true, mobile: true },
      },
      rentRevisions: { orderBy: { effectiveDate: "desc" }, take: 10 },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          invoiceType: true,
          status: true,
          totalHT: true,
          dueDate: true,
          invoiceNumber: true,
        },
      },
      chargeProvisions: {
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          label: true,
          monthlyAmount: true,
          vatRate: true,
          startDate: true,
          endDate: true,
          isActive: true,
        },
      },
      amendments: {
        orderBy: { amendmentNumber: "desc" },
        select: {
          id: true,
          amendmentNumber: true,
          effectiveDate: true,
          description: true,
          amendmentType: true,
          previousRentHT: true,
          newRentHT: true,
          previousEndDate: true,
          newEndDate: true,
          createdAt: true,
        },
      },
      signatureRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          signerEmail: true,
          signerName: true,
          documentName: true,
          createdAt: true,
          signedAt: true,
          declinedAt: true,
          voidedAt: true,
        },
      },
      leaseTemplate: {
        select: { id: true, name: true, leaseType: true },
      },
      inspections: {
        orderBy: { performedAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          performedAt: true,
          performedBy: true,
        },
      },
      _count: {
        select: {
          invoices: true,
          rentRevisions: true,
          inspections: true,
          amendments: true,
        },
      },
    },
  });
}
