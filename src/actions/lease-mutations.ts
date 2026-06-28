"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createLeaseSchema,
  updateLeaseSchema,
  transferLeaseTenantSchema,
  createRentStepsSchema,
  updateRentStepSchema,
  type CreateLeaseInput,
  type UpdateLeaseInput,
  type TransferLeaseTenantInput,
  type CreateRentStepsInput,
} from "@/validations/lease";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import { formatTenantName, generateLeaseNumber } from "@/actions/lease-shared";

export async function createLease(
  societyId: string,
  input: CreateLeaseInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

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

    // Le premier lot de la liste est le lot principal
    const primaryLotId = data.lotIds[0];

    // Vérifier que tous les lots appartiennent à la société
    const lots = await prisma.lot.findMany({
      where: { id: { in: data.lotIds }, building: { societyId } },
      select: { id: true, buildingId: true },
    });
    if (lots.length !== data.lotIds.length) {
      return { success: false, error: "Un ou plusieurs lots sont introuvables" };
    }

    // Vérifier que le locataire appartient à la société
    const tenant = await prisma.tenant.findFirst({
      where: { id: data.tenantId, societyId, isActive: true, deletedAt: null },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable ou inactif" };

    // Vérifier qu'aucun lot n'a déjà un bail actif
    const existingActiveLeases = await prisma.leaseLot.findMany({
      where: {
        lotId: { in: data.lotIds },
        lease: { societyId, status: "EN_COURS", deletedAt: null },
      },
      include: { lot: { select: { number: true } } },
    });
    if (existingActiveLeases.length > 0) {
      const lotNumbers = existingActiveLeases.map((ll) => ll.lot.number).join(", ");
      return {
        success: false,
        error: `Le(s) lot(s) ${lotNumbers} ont déjà un bail actif. Résiliez-le avant d'en créer un nouveau.`,
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
        lotId: primaryLotId,
        tenantId: data.tenantId,
        leaseNumber,
        leaseTemplateId: data.leaseTemplateId ?? null,
        leaseType: data.leaseType,
        destination: data.destination ?? null,
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
        fixedAnnualIndexationRate: data.fixedAnnualIndexationRate ?? null,
        rentFreeMonths: data.rentFreeMonths,
        entryFee: data.entryFee,
        tenantWorksClauses: data.tenantWorksClauses ?? null,
        isThirdPartyManaged: data.isThirdPartyManaged ?? false,
        managingContactId: data.managingContactId ?? null,
        managementFeeType: data.managementFeeType ?? null,
        managementFeeValue: data.managementFeeValue ?? null,
        managementFeeBasis: data.managementFeeBasis ?? null,
        managementFeeVatRate: data.managementFeeVatRate ?? null,
        // Créer les entrées LeaseLot
        leaseLots: {
          create: data.lotIds.map((lotId, index) => ({
            lotId,
            isPrimary: index === 0,
          })),
        },
      },
    });

    await prisma.leaseTenantHistory.create({
      data: {
        societyId,
        leaseId: lease.id,
        tenantId: data.tenantId,
        startDate,
      },
    });

    // Mettre à jour le statut de tous les lots
    await prisma.lot.updateMany({
      where: { id: { in: data.lotIds } },
      data: { status: "OCCUPE" },
    });
    // Mettre à jour le loyer uniquement sur le lot principal
    await prisma.lot.update({
      where: { id: primaryLotId },
      data: { currentRent: data.baseRentHT },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Lease",
      entityId: lease.id,
      details: {
        lotIds: data.lotIds,
        tenantId: data.tenantId,
        baseRentHT: data.baseRentHT,
        startDate: data.startDate,
      },
    });

    revalidatePath("/baux");
    for (const lot of lots) {
      revalidatePath(`/patrimoine/immeubles/${lot.buildingId}`);
    }
    revalidatePath(`/locataires/${data.tenantId}`);

    return { success: true, data: { id: lease.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifié" };
    }
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
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateLeaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { id, entryDate, exitDate, startDate, endDate, ...data } = parsed.data;

    const existing = await prisma.lease.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!existing) return { success: false, error: "Bail introuvable" };

    const updateData: Record<string, unknown> = { ...data };
    if (entryDate !== undefined) updateData.entryDate = entryDate ? new Date(entryDate) : null;
    if (exitDate !== undefined) updateData.exitDate = exitDate ? new Date(exitDate) : null;
    if (startDate !== undefined && startDate) updateData.startDate = new Date(startDate);
    if (endDate !== undefined && endDate) updateData.endDate = new Date(endDate);

    // Si résiliation : mettre à jour tous les lots du bail
    if (data.status === "RESILIE" && existing.status !== "RESILIE") {
      updateData.exitDate = updateData.exitDate ?? new Date();
      const leaseLots = await prisma.leaseLot.findMany({
        where: { leaseId: id },
        select: { lotId: true },
      });
      const lotIds = leaseLots.map((ll) => ll.lotId);
      if (lotIds.length > 0) {
        await prisma.lot.updateMany({
          where: { id: { in: lotIds } },
          data: { status: "VACANT", currentRent: null },
        });
      }
    }

    await prisma.lease.update({ where: { id }, data: updateData });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Lease",
      entityId: id,
      details: { updatedFields: Object.keys(parsed.data) },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${id}`);

    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifié" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    console.error("[updateLease]", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function transferLeaseTenant(
  societyId: string,
  input: TransferLeaseTenantInput
): Promise<ActionResult<{ oldTenantId: string; newTenantId: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = transferLeaseTenantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const {
      leaseId,
      newTenantId,
      effectiveDate,
      transferType,
      transferReason,
      transferDocumentId,
    } = parsed.data;
    const effectiveAt = new Date(effectiveDate);
    if (Number.isNaN(effectiveAt.getTime())) {
      return { success: false, error: "Date d'effet invalide" };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        status: true,
        startDate: true,
        endDate: true,
        tenant: {
          select: {
            entityType: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };
    if (lease.status === "RESILIE") {
      return { success: false, error: "Impossible de changer le locataire d'un bail résilié" };
    }
    if (lease.tenantId === newTenantId) {
      return { success: false, error: "Le nouveau locataire est déjà titulaire du bail" };
    }
    if (effectiveAt < lease.startDate) {
      return { success: false, error: "La date d'effet ne peut pas précéder le début du bail" };
    }
    if (lease.endDate && effectiveAt > lease.endDate) {
      return { success: false, error: "La date d'effet ne peut pas dépasser la fin du bail" };
    }

    const newTenant = await prisma.tenant.findFirst({
      where: { id: newTenantId, societyId, deletedAt: null, isActive: true },
      select: {
        id: true,
        entityType: true,
        companyName: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!newTenant) return { success: false, error: "Nouveau locataire introuvable ou inactif" };

    if (transferDocumentId) {
      const document = await prisma.document.findFirst({
        where: { id: transferDocumentId, societyId, deletedAt: null },
        select: { id: true },
      });
      if (!document) return { success: false, error: "Document de cession introuvable" };
    }

    const oldTenantId = lease.tenantId;
    const oldTenantName = formatTenantName(lease.tenant);
    const newTenantName = formatTenantName(newTenant);

    await prisma.$transaction(async (tx) => {
      const activeHistory = await tx.leaseTenantHistory.findFirst({
        where: { societyId, leaseId, endDate: null },
        orderBy: { startDate: "desc" },
        select: { id: true, startDate: true, tenantId: true },
      });

      if (activeHistory) {
        if (effectiveAt < activeHistory.startDate) {
          throw new Error("TRANSFER_DATE_BEFORE_ACTIVE_HOLDER");
        }
        await tx.leaseTenantHistory.update({
          where: { id: activeHistory.id },
          data: { endDate: effectiveAt },
        });
      } else {
        await tx.leaseTenantHistory.create({
          data: {
            societyId,
            leaseId,
            tenantId: oldTenantId,
            startDate: lease.startDate,
            endDate: effectiveAt,
          },
        });
      }

      await tx.leaseTenantHistory.create({
        data: {
          societyId,
          leaseId,
          tenantId: newTenantId,
          startDate: effectiveAt,
          transferType,
          transferReason: transferReason || null,
          transferDocumentId: transferDocumentId || null,
        },
      });

      await tx.lease.update({
        where: { id: leaseId },
        data: { tenantId: newTenantId },
      });

      await tx.legalEvent.create({
        data: {
          societyId,
          leaseId,
          type: "CESSION",
          title: `Changement de locataire : ${oldTenantName} → ${newTenantName}`,
          description: transferReason || null,
          eventDate: effectiveAt,
          status: "RESOLU",
          resolvedAt: new Date(),
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Lease",
      entityId: leaseId,
      details: {
        action: "TRANSFER_TENANT",
        oldTenantId,
        newTenantId,
        effectiveDate,
        transferType,
      },
    });

    revalidatePath("/baux");
    revalidatePath(`/baux/${leaseId}`);
    revalidatePath(`/locataires/${oldTenantId}`);
    revalidatePath(`/locataires/${newTenantId}`);
    revalidatePath("/facturation");

    return { success: true, data: { oldTenantId, newTenantId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: "Non authentifié" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message === "TRANSFER_DATE_BEFORE_ACTIVE_HOLDER") {
      return {
        success: false,
        error: "La date d'effet ne peut pas précéder le titulaire actuel",
      };
    }
    console.error("[transferLeaseTenant]", error);
    return { success: false, error: "Erreur lors du changement de locataire" };
  }
}

export async function deleteLease(
  societyId: string,
  leaseId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "ADMIN_SOCIETE");

    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId, deletedAt: null },
      select: { id: true, status: true, lotId: true, leaseLots: { select: { lotId: true } } },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    if (lease.status === "EN_COURS") {
      return {
        success: false,
        error: "Impossible de supprimer un bail en cours. Résiliez-le d'abord.",
      };
    }

    const lotIds = lease.leaseLots.map((ll) => ll.lotId);

    await prisma.lease.update({
      where: { id: leaseId },
      data: {
        deletedAt: new Date(),
        deletedBy: context.userId,
        archivedReason: "Suppression utilisateur",
      },
    });

    // Remettre chaque lot en vacant s'il n'a plus de bail actif
    for (const lotId of lotIds) {
      const remainingActive = await prisma.leaseLot.count({
        where: { lotId, lease: { status: "EN_COURS", deletedAt: null } },
      });
      if (remainingActive === 0) {
        await prisma.lot.update({
          where: { id: lotId },
          data: { status: "VACANT" },
        });
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "Lease",
      entityId: leaseId,
    });

    revalidatePath("/baux");
    revalidatePath(`/patrimoine/immeubles`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteLease]", error);
    return { success: false, error: "Erreur lors de la suppression du bail" };
  }
}

export async function createRentSteps(
  societyId: string,
  input: CreateRentStepsInput
): Promise<ActionResult<{ count: number }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = createRentStepsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { leaseId, steps } = parsed.data;

    // Vérifier que le bail appartient à la société
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId, deletedAt: null },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };

    // Vérifier que les paliers respectent la période du bail
    const leaseStart = new Date(lease.startDate);
    const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
    const sorted = [...steps].sort((a, b) => a.startDate.localeCompare(b.startDate));

    for (const step of sorted) {
      const stepStart = new Date(step.startDate);
      const stepEnd = step.endDate ? new Date(step.endDate) : null;

      if (stepStart < leaseStart) {
        return {
          success: false,
          error: `Le palier "${step.label}" commence avant le début du bail (${leaseStart.toLocaleDateString("fr-FR")})`,
        };
      }
      if (leaseEnd && stepStart > leaseEnd) {
        return {
          success: false,
          error: `Le palier "${step.label}" commence après la fin du bail (${leaseEnd.toLocaleDateString("fr-FR")})`,
        };
      }
      if (leaseEnd && stepEnd && stepEnd > leaseEnd) {
        return {
          success: false,
          error: `Le palier "${step.label}" se termine après la fin du bail (${leaseEnd.toLocaleDateString("fr-FR")})`,
        };
      }
    }

    // Supprimer les anciens paliers et recréer
    await prisma.leaseRentStep.deleteMany({ where: { leaseId } });

    const created = await prisma.leaseRentStep.createMany({
      data: steps.map((step, index) => ({
        leaseId,
        label: step.label,
        startDate: new Date(step.startDate),
        endDate: step.endDate ? new Date(step.endDate) : null,
        rentHT: step.rentHT,
        chargesHT: step.chargesHT ?? null,
        position: index,
      })),
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "LeaseRentStep",
      entityId: leaseId,
      details: { stepsCount: created.count },
    });

    revalidatePath(`/baux/${leaseId}`);
    return { success: true, data: { count: created.count } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createRentSteps]", error);
    return { success: false, error: "Erreur lors de la création des paliers" };
  }
}

export async function updateRentStep(
  societyId: string,
  input: { id: string; label: string; startDate: string; endDate?: string | null; rentHT: number; chargesHT?: number | null }
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const parsed = updateRentStepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };
    }

    const { id, ...data } = parsed.data;

    const step = await prisma.leaseRentStep.findFirst({
      where: { id, lease: { societyId, deletedAt: null } },
      select: { id: true, leaseId: true },
    });
    if (!step) return { success: false, error: "Palier introuvable" };

    // Vérifier cohérence avec le bail et les autres paliers
    const lease = await prisma.lease.findFirst({
      where: { id: step.leaseId, societyId, deletedAt: null },
      select: { startDate: true, endDate: true },
    });
    if (lease) {
      const leaseStart = new Date(lease.startDate);
      const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
      const newStart = new Date(data.startDate);
      const newEnd = data.endDate ? new Date(data.endDate) : null;

      if (newEnd && newEnd <= newStart) {
        return { success: false, error: "La date de fin doit être postérieure à la date de début" };
      }
      if (newStart < leaseStart) {
        return { success: false, error: `La date de début ne peut pas être antérieure au début du bail (${leaseStart.toLocaleDateString("fr-FR")})` };
      }
      if (leaseEnd && newStart > leaseEnd) {
        return { success: false, error: `La date de début ne peut pas être postérieure à la fin du bail (${leaseEnd.toLocaleDateString("fr-FR")})` };
      }
      if (leaseEnd && newEnd && newEnd > leaseEnd) {
        return { success: false, error: `La date de fin ne peut pas dépasser la fin du bail (${leaseEnd.toLocaleDateString("fr-FR")})` };
      }

      // Vérifier les chevauchements avec les autres paliers
      const otherSteps = await prisma.leaseRentStep.findMany({
        where: { leaseId: step.leaseId, id: { not: id } },
        select: { label: true, startDate: true, endDate: true },
        orderBy: { startDate: "asc" },
      });
      for (const other of otherSteps) {
        const oStart = new Date(other.startDate);
        const oEnd = other.endDate ? new Date(other.endDate) : null;

        const overlap =
          (newEnd ? newEnd > oStart : true) && (oEnd ? oEnd > newStart : true);
        if (overlap) {
          return { success: false, error: `Chevauchement avec le palier "${other.label}"` };
        }
      }
    }

    await prisma.leaseRentStep.update({
      where: { id },
      data: {
        label: data.label,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        rentHT: data.rentHT,
        chargesHT: data.chargesHT ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "LeaseRentStep",
      entityId: id,
    });

    revalidatePath(`/baux/${step.leaseId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[updateRentStep]", error);
    return { success: false, error: "Erreur lors de la mise à jour du palier" };
  }
}

export async function deleteRentStep(
  societyId: string,
  stepId: string
): Promise<ActionResult> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const step = await prisma.leaseRentStep.findFirst({
      where: { id: stepId, lease: { societyId, deletedAt: null } },
      select: { id: true, leaseId: true },
    });
    if (!step) return { success: false, error: "Palier introuvable" };

    await prisma.leaseRentStep.delete({ where: { id: stepId } });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "LeaseRentStep",
      entityId: stepId,
    });

    revalidatePath(`/baux/${step.leaseId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: "Non authentifié" };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteRentStep]", error);
    return { success: false, error: "Erreur lors de la suppression du palier" };
  }
}
