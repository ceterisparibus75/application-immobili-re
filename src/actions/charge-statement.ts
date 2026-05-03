"use server";

import { createHash } from "crypto";
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
  occupancyStart?: string;
  occupancyEnd?: string;
  categories?: ChargeCategory[];
  totalRecoverableAllocated?: number;
};

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateOnlyIso(date: Date): string {
  const normalized = dayStart(date);
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${normalized.getFullYear()}-${month}-${day}`;
}

function clampOccupancyStart(periodStart: Date, leaseStart?: Date | null): string {
  const rawStart = leaseStart ?? periodStart;
  return dateOnlyIso(new Date(Math.max(dayStart(periodStart).getTime(), dayStart(rawStart).getTime())));
}

function clampOccupancyEnd(periodEnd: Date, leaseEnd?: Date | null): string {
  const rawEnd = leaseEnd ?? periodEnd;
  return dateOnlyIso(new Date(Math.min(dayStart(periodEnd).getTime(), dayStart(rawEnd).getTime())));
}

export async function sendChargeRegularization(
  societyId: string,
  regularizationId: string
): Promise<ActionResult<{ emailId?: string; deliveryId?: string; proofId?: string }>> {
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
      occupancyStart: details?.occupancyStart ?? clampOccupancyStart(reg.periodStart, reg.lease.startDate),
      occupancyEnd: details?.occupancyEnd ?? clampOccupancyEnd(reg.periodEnd, reg.lease.endDate),
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
      proofContext: {
        societyId,
        sentById: context.userId,
        entityType: "CHARGE_STATEMENT",
        entityId: reg.id,
        tenantId: tenant.id,
        leaseId: reg.lease.id,
        recipientName: tenantName,
        evidence: {
          route: "sendChargeRegularization",
          regularizationId: reg.id,
          fiscalYear: reg.fiscalYear,
          periodStart: reg.periodStart.toISOString(),
          periodEnd: reg.periodEnd.toISOString(),
          lotNumber: reg.lease.lot.number,
          buildingName: reg.lease.lot.building.name,
        },
      },
    });

    if (!emailResult.success) {
      return { success: false, error: emailResult.error ?? "Erreur lors de l'envoi du décompte" };
    }

    const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");
    const delivery = await prisma.chargeStatementDelivery.create({
      data: {
        regularizationId: reg.id,
        societyId,
        leaseId: reg.lease.id,
        tenantId: tenant.id,
        sentById: context.userId,
        fiscalYear: reg.fiscalYear,
        periodStart: reg.periodStart,
        periodEnd: reg.periodEnd,
        balance: reg.balance,
        recipientEmail: tenant.email,
        recipientName: tenantName,
        provider: "resend",
        providerMessageId: emailResult.emailId,
        status: "SENT",
        pdfSha256,
        pdfSizeBytes: pdfBuffer.length,
        evidence: {
          deliveryMethod: "EMAIL",
          attachmentFilename: `decompte-charges-${reg.fiscalYear}.pdf`,
          generatedAt: new Date().toISOString(),
          lotNumber: reg.lease.lot.number,
          buildingName: reg.lease.lot.building.name,
        },
      },
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
        proofId: emailResult.proofId ?? null,
        proofError: emailResult.proofError ?? null,
        deliveryProofId: delivery.id,
        pdfSha256,
        fiscalYear: reg.fiscalYear,
        tenantEmail: tenant.email,
      },
    });

    revalidatePath("/charges/comptes-rendus");
    return { success: true, data: { emailId: emailResult.emailId, deliveryId: delivery.id, proofId: emailResult.proofId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[sendChargeRegularization]", error);
    return { success: false, error: "Erreur lors de l'envoi du decompte" };
  }
}
