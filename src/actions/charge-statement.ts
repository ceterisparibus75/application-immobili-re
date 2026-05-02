"use server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { requireSocietyActionContext, UnauthenticatedActionError } from "@/lib/action-society";
import { ForbiddenError } from "@/lib/permissions";
import { sendChargeStatementEmail } from "@/lib/email";
import { generateChargeStatementPdfBuffer } from "@/lib/charge-statement-pdf";

type ChargeCategory = {
  categoryName: string;
  nature: string;
  totalAmount: number;
  recoverableAmount: number;
  allocationMethod: string;
  allocationRate: number;
  tenantShare: number;
};

type ChargeStatementDetails = {
  tenantName?: string;
  lotNumber?: string;
  buildingId?: string;
  prorataDays?: number;
  categories?: ChargeCategory[];
  totalRecoverableAllocated?: number;
};

export async function sendChargeRegularization(
  societyId: string,
  regularizationId: string
): Promise<ActionResult<{ emailId?: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const reg = await prisma.chargeRegularization.findFirst({
      where: { id: regularizationId, societyId },
      include: {
        lease: {
          include: {
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                entityType: true,
                email: true,
              },
            },
            lot: {
              include: {
                building: { select: { id: true, name: true, city: true } },
              },
            },
          },
        },
      },
    });

    if (!reg) return { success: false, error: "Regularisation introuvable" };

    const { tenant } = reg.lease;
    if (!tenant.email) return { success: false, error: "Le locataire n'a pas d'email" };

    const tenantName =
      tenant.entityType === "PERSONNE_MORALE"
        ? (tenant.companyName ?? "Locataire")
        : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire";

    const society = await prisma.society.findUnique({
      where: { id: societyId },
      select: {
        name: true,
        addressLine1: true,
        postalCode: true,
        city: true,
        email: true,
        logoUrl: true,
        siret: true,
        phone: true,
      },
    });

    const details = reg.details as ChargeStatementDetails | null;

    const pdfBuffer = await generateChargeStatementPdfBuffer({
      fiscalYear: reg.fiscalYear,
      periodStart: reg.periodStart.toISOString(),
      periodEnd: reg.periodEnd.toISOString(),
      tenantName,
      lotNumber: reg.lease.lot.number,
      buildingName: reg.lease.lot.building.name,
      totalCharges: reg.totalCharges,
      totalProvisions: reg.totalProvisions,
      balance: reg.balance,
      categories: details?.categories ?? [],
      prorataDays: details?.prorataDays ?? 365,
      society: society
        ? {
            name: society.name,
            addressLine1: society.addressLine1,
            postalCode: society.postalCode,
            city: society.city,
            email: society.email,
          }
        : null,
    });

    const emailResult = await sendChargeStatementEmail({
      to: tenant.email,
      tenantName,
      societyName: society?.name ?? "Votre gestionnaire",
      fiscalYear: reg.fiscalYear,
      balance: reg.balance,
      pdfBuffer,
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "ChargeRegularization",
      entityId: regularizationId,
      details: {
        event: "CHARGE_STATEMENT_SENT",
        emailId: emailResult.emailId,
        fiscalYear: reg.fiscalYear,
        tenantEmail: tenant.email,
      },
    });

    revalidatePath("/charges/comptes-rendus");
    return { success: true, data: { emailId: emailResult.emailId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[sendChargeRegularization]", error);
    return { success: false, error: "Erreur lors de l'envoi du decompte" };
  }
}
