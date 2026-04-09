"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import { createManagementReportSchema } from "@/validations/management-report";
import { analyzeManagementReport } from "@/lib/management-report-ai";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriodLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return `${fmt(start)} - ${fmt(end)}`;
}

/** Atomic invoice numbering inside a transaction (same logic as invoice.ts). */
async function getNextInvoiceNumber(
  societyId: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const currentYear = new Date().getFullYear();

  const current = await tx.society.findUnique({
    where: { id: societyId },
    select: { invoiceNumberYear: true, nextInvoiceNumber: true, invoicePrefix: true },
  });

  const yearChanged = !current || current.invoiceNumberYear !== currentYear;

  const society = await tx.society.update({
    where: { id: societyId },
    data: yearChanged
      ? { invoiceNumberYear: currentYear, nextInvoiceNumber: 1 }
      : { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true, invoicePrefix: true },
  });

  const prefix = current?.invoicePrefix?.toUpperCase() || "FAC";
  return `${prefix}-${currentYear}-${String(society.nextInvoiceNumber).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// 1. getManagementReports
// ---------------------------------------------------------------------------

export async function getManagementReports(
  societyId: string,
  leaseId?: string
): Promise<ActionResult<{ reports: unknown[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const where: Prisma.ManagementReportWhereInput = { societyId };
    if (leaseId) {
      where.leaseId = leaseId;
    }

    const reports = await prisma.managementReport.findMany({
      where,
      include: {
        lease: {
          include: {
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
              },
            },
            lot: {
              include: {
                building: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { periodStart: "desc" },
    });

    return { success: true, data: { reports } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getManagementReports]", error);
    return { success: false, error: "Erreur lors de la recuperation des comptes rendus de gestion" };
  }
}

// ---------------------------------------------------------------------------
// 2. getManagementReportById
// ---------------------------------------------------------------------------

export async function getManagementReportById(
  societyId: string,
  reportId: string
): Promise<ActionResult<{ report: unknown }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const report = await prisma.managementReport.findFirst({
      where: { id: reportId, societyId },
      include: {
        lease: {
          include: {
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
              },
            },
            lot: {
              include: {
                building: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!report) return { success: false, error: "Compte rendu de gestion introuvable" };

    return { success: true, data: { report } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getManagementReportById]", error);
    return { success: false, error: "Erreur lors de la recuperation du compte rendu de gestion" };
  }
}

// ---------------------------------------------------------------------------
// 3. uploadAndAnalyzeReport
// ---------------------------------------------------------------------------

export async function uploadAndAnalyzeReport(
  societyId: string,
  leaseId: string,
  fileUrl: string,
  fileStoragePath: string
): Promise<ActionResult<{ id: string; report: unknown }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // Fetch lease with context for AI
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, societyId },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        lot: {
          include: {
            building: {
              select: { id: true, name: true, addressLine1: true, city: true },
            },
          },
        },
      },
    });

    if (!lease) return { success: false, error: "Bail introuvable" };
    if (!lease.isThirdPartyManaged) {
      return { success: false, error: "Ce bail n'est pas en gestion tiers" };
    }

    // Fetch the file as a Buffer for AI analysis
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return { success: false, error: "Impossible de telecharger le fichier" };
    }
    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    // Build context for the AI
    const tenantName = lease.tenant.companyName
      ?? `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim();
    const leaseContext = {
      tenantName,
      lotLabel: `${lease.lot.building.name} — Lot ${lease.lot.number}`,
      currentRentHT: lease.currentRentHT,
      managementFeeValue: lease.managementFeeValue ?? 0,
      managementFeeType: lease.managementFeeType ?? "POURCENTAGE",
    };

    // Determine MIME type from URL
    const mimeType = fileUrl.endsWith(".pdf") ? "application/pdf" : "image/jpeg";

    // Call AI analysis
    const aiResult = await analyzeManagementReport(fileBuffer, mimeType, leaseContext);

    // Create the ManagementReport
    const report = await prisma.managementReport.create({
      data: {
        societyId,
        leaseId,
        periodStart: aiResult.periodStart ? new Date(aiResult.periodStart) : new Date(),
        periodEnd: aiResult.periodEnd ? new Date(aiResult.periodEnd) : new Date(),
        grossRent: aiResult.grossRent ?? 0,
        chargesAmount: aiResult.chargesAmount ?? null,
        feeAmountHT: aiResult.feeAmountHT ?? 0,
        feeAmountTTC: aiResult.feeAmountTTC ?? 0,
        netTransfer: aiResult.netTransfer ?? 0,
        reportFileUrl: fileUrl,
        reportFileStoragePath: fileStoragePath,
        aiAnalyzed: true,
        aiRawResponse: aiResult as unknown as Prisma.InputJsonValue,
        aiConfidence: aiResult.confidence,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ManagementReport",
      entityId: report.id,
      details: { leaseId, aiAnalyzed: true, aiConfidence: aiResult.confidence },
    });

    revalidatePath(`/baux/${leaseId}`);

    return { success: true, data: { id: report.id, report } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[uploadAndAnalyzeReport]", error);
    return { success: false, error: "Erreur lors de l'analyse du compte rendu de gestion" };
  }
}

// ---------------------------------------------------------------------------
// 4. confirmManagementReport
// ---------------------------------------------------------------------------

export async function confirmManagementReport(
  societyId: string,
  reportId: string
): Promise<ActionResult<{ invoiceId: string; paymentId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    // 1. Fetch the report with lease context
    const report = await prisma.managementReport.findFirst({
      where: { id: reportId, societyId },
      include: {
        lease: {
          include: {
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
              },
            },
            lot: {
              select: { id: true, number: true },
            },
          },
        },
      },
    });

    if (!report) return { success: false, error: "Compte rendu de gestion introuvable" };

    // 2. Verify not already reconciled
    if (report.isReconciled) {
      return { success: false, error: "Ce compte rendu est deja rapproche" };
    }

    const periodLabel = formatPeriodLabel(report.periodStart, report.periodEnd);
    const lotNumber = report.lease.lot.number;
    const tenantId = report.lease.tenantId;
    const leaseId = report.leaseId;
    const vatRate = report.lease.vatRate ?? 20;

    // Management fee VAT (feeAmountTTC - feeAmountHT)
    const managementFeeVAT = report.feeAmountTTC - report.feeAmountHT;

    // 3-4. Create invoice + payment inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await getNextInvoiceNumber(societyId, tx);

      // Build invoice lines
      const lines: {
        label: string;
        quantity: number;
        unitPrice: number;
        vatRate: number;
        totalHT: number;
        totalVAT: number;
        totalTTC: number;
      }[] = [];

      // Rent line
      const rentHT = report.grossRent;
      const rentVAT = rentHT * (vatRate / 100);
      const rentTTC = rentHT + rentVAT;
      lines.push({
        label: `Loyer ${lotNumber} - ${periodLabel}`,
        quantity: 1,
        unitPrice: rentHT,
        vatRate,
        totalHT: rentHT,
        totalVAT: rentVAT,
        totalTTC: rentTTC,
      });

      // Charges line (if applicable)
      if (report.chargesAmount && report.chargesAmount > 0) {
        const chargesHT = report.chargesAmount;
        const chargesVAT = chargesHT * (vatRate / 100);
        const chargesTTC = chargesHT + chargesVAT;
        lines.push({
          label: `Charges ${lotNumber} - ${periodLabel}`,
          quantity: 1,
          unitPrice: chargesHT,
          vatRate,
          totalHT: chargesHT,
          totalVAT: chargesVAT,
          totalTTC: chargesTTC,
        });
      }

      const totalHT = lines.reduce((sum, l) => sum + l.totalHT, 0);
      const totalVAT = lines.reduce((sum, l) => sum + l.totalVAT, 0);
      const totalTTC = lines.reduce((sum, l) => sum + l.totalTTC, 0);

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          societyId,
          leaseId,
          tenantId,
          invoiceNumber,
          invoiceType: "APPEL_LOYER",
          status: "PAYE",
          issueDate: new Date(),
          dueDate: new Date(),
          periodStart: report.periodStart,
          periodEnd: report.periodEnd,
          totalHT,
          totalVAT,
          totalTTC,
          isThirdPartyManaged: true,
          managementFeeHT: report.feeAmountHT,
          managementFeeVAT,
          managementFeeTTC: report.feeAmountTTC,
          expectedNetAmount: report.netTransfer,
          lines: { create: lines },
        },
      });

      // Create the payment (net amount transferred by agency)
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: report.netTransfer,
          paidAt: new Date(),
          method: "Virement agence",
          reference: `CRG ${periodLabel}`,
        },
      });

      // 5. Update the ManagementReport as reconciled
      await tx.managementReport.update({
        where: { id: reportId },
        data: {
          isReconciled: true,
          reconciledPaymentId: payment.id,
          reconciledAt: new Date(),
        },
      });

      return { invoiceId: invoice.id, paymentId: payment.id };
    });

    // 6. Audit log
    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ManagementReport",
      entityId: reportId,
      details: {
        action: "confirm",
        invoiceId: result.invoiceId,
        paymentId: result.paymentId,
        netTransfer: report.netTransfer,
      },
    });

    revalidatePath(`/baux/${leaseId}`);
    revalidatePath("/facturation");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[confirmManagementReport]", error);
    return { success: false, error: "Erreur lors de la confirmation du compte rendu de gestion" };
  }
}

// ---------------------------------------------------------------------------
// 5. createManualReport
// ---------------------------------------------------------------------------

export async function createManualReport(
  societyId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const parsed = createManagementReportSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    // Verify the lease belongs to this society and is third-party managed
    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };
    if (!lease.isThirdPartyManaged) {
      return { success: false, error: "Ce bail n'est pas en gestion tiers" };
    }

    const report = await prisma.managementReport.create({
      data: {
        societyId,
        leaseId: parsed.data.leaseId,
        periodStart: new Date(parsed.data.periodStart),
        periodEnd: new Date(parsed.data.periodEnd),
        grossRent: parsed.data.grossRent,
        chargesAmount: parsed.data.chargesAmount ?? null,
        feeAmountHT: parsed.data.feeAmountHT,
        feeAmountTTC: parsed.data.feeAmountTTC,
        netTransfer: parsed.data.netTransfer,
        aiAnalyzed: false,
        notes: parsed.data.notes ?? null,
      },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ManagementReport",
      entityId: report.id,
      details: { leaseId: parsed.data.leaseId, aiAnalyzed: false },
    });

    revalidatePath(`/baux/${parsed.data.leaseId}`);

    return { success: true, data: { id: report.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createManualReport]", error);
    return { success: false, error: "Erreur lors de la creation du compte rendu de gestion" };
  }
}

// ---------------------------------------------------------------------------
// 6. deleteManagementReport
// ---------------------------------------------------------------------------

export async function deleteManagementReport(
  societyId: string,
  reportId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifie" };

    await requireSocietyAccess(session.user.id, societyId, "GESTIONNAIRE");

    const report = await prisma.managementReport.findFirst({
      where: { id: reportId, societyId },
    });

    if (!report) return { success: false, error: "Compte rendu de gestion introuvable" };

    if (report.isReconciled) {
      return { success: false, error: "Impossible de supprimer un compte rendu deja rapproche" };
    }

    await prisma.managementReport.delete({
      where: { id: reportId },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "DELETE",
      entity: "ManagementReport",
      entityId: reportId,
      details: { leaseId: report.leaseId },
    });

    revalidatePath(`/baux/${report.leaseId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[deleteManagementReport]", error);
    return { success: false, error: "Erreur lors de la suppression du compte rendu de gestion" };
  }
}
