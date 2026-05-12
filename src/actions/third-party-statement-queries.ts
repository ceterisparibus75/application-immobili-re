"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import type { StatementFilters } from "@/actions/third-party-statement-shared";

export async function getThirdPartyManagedLeases(
  societyId: string
): Promise<ActionResult<{ leases: unknown[] }>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const leases = await prisma.lease.findMany({
      where: {
        societyId,
        isThirdPartyManaged: true,
        status: { in: ["EN_COURS", "RENOUVELE"] },
      },
      select: {
        id: true,
        leaseNumber: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        managementFeeType: true,
        managementFeeValue: true,
        managementFeeBasis: true,
        managementFeeVatRate: true,
        lot: {
          select: {
            id: true,
            number: true,
            lotType: true,
            building: { select: { id: true, name: true, addressLine1: true } },
          },
        },
        tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        chargeProvisions: {
          where: { isActive: true },
          select: { id: true, label: true, monthlyAmount: true },
        },
      },
      orderBy: { leaseNumber: "asc" },
    });

    return { success: true, data: { leases } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getThirdPartyManagedLeases]", error);
    return { success: false, error: "Erreur lors de la récupération des baux" };
  }
}

// ─── Création ────────────────────────────────────────────────────────


export async function getStatements(
  societyId: string,
  filters?: StatementFilters
): Promise<ActionResult<{ statements: unknown[] }>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const where: Record<string, unknown> = { societyId };

    if (filters?.buildingId) where.buildingId = filters.buildingId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    // Pour le filtre par bail : chercher dans le bail principal OU les liaisons multi-baux
    if (filters?.leaseId) {
      where.OR = [
        { leaseId: filters.leaseId },
        { leases: { some: { leaseId: filters.leaseId } } },
      ];
    }

    const statements = await prisma.thirdPartyStatement.findMany({
      where,
      include: {
        lines: true,
        leases: {
          include: {
            lease: {
              select: {
                id: true,
                leaseNumber: true,
                lot: { select: { id: true, number: true, lotType: true } },
                tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
              },
            },
          },
        },
        building: { select: { id: true, name: true } },
        lease: {
          select: {
            id: true,
            leaseNumber: true,
            lot: { select: { id: true, number: true, lotType: true } },
            tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
          },
        },
        contact: { select: { id: true, name: true } },
      },
      orderBy: { receivedDate: "desc" },
    });

    return { success: true, data: { statements } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getStatements]", error);
    return { success: false, error: "Erreur lors de la récupération des relevés" };
  }
}

// ─── Détail ──────────────────────────────────────────────────────────

export async function getStatementById(
  societyId: string,
  statementId: string
): Promise<ActionResult<{ statement: unknown }>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const statement = await prisma.thirdPartyStatement.findFirst({
      where: { id: statementId, societyId },
      include: {
        lines: {
          include: {
            lease: {
              select: {
                id: true,
                leaseNumber: true,
                lot: { select: { number: true } },
                tenant: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        leases: {
          include: {
            lease: {
              select: {
                id: true,
                leaseNumber: true,
                currentRentHT: true,
                vatApplicable: true,
                vatRate: true,
                isThirdPartyManaged: true,
                managementFeeType: true,
                managementFeeValue: true,
                managementFeeBasis: true,
                managementFeeVatRate: true,
                lot: { select: { id: true, number: true, lotType: true, building: { select: { name: true } } } },
                tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
                chargeProvisions: {
                  where: { isActive: true },
                  select: { id: true, label: true, monthlyAmount: true },
                },
              },
            },
          },
        },
        building: { select: { id: true, name: true, addressLine1: true, city: true } },
        lease: {
          select: {
            id: true,
            leaseNumber: true,
            currentRentHT: true,
            vatApplicable: true,
            vatRate: true,
            isThirdPartyManaged: true,
            managementFeeType: true,
            managementFeeValue: true,
            managementFeeBasis: true,
            managementFeeVatRate: true,
            lot: { select: { id: true, number: true, lotType: true } },
            tenant: { select: { id: true, firstName: true, lastName: true, companyName: true } },
            chargeProvisions: {
              where: { isActive: true },
              select: { id: true, label: true, monthlyAmount: true },
            },
          },
        },
        contact: { select: { id: true, name: true, company: true, phone: true, email: true } },
        document: { select: { id: true, fileName: true, fileUrl: true } },
        charges: {
          select: { id: true, description: true, amount: true, isPaid: true },
        },
        bankReconciliations: {
          include: {
            transaction: { select: { id: true, label: true, amount: true, transactionDate: true, reference: true } },
          },
        },
      },
    });

    if (!statement) return { success: false, error: "Relevé introuvable" };

    return { success: true, data: { statement } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getStatementById]", error);
    return { success: false, error: "Erreur lors de la récupération du relevé" };
  }
}

// ─── Mise à jour ─────────────────────────────────────────────────────

