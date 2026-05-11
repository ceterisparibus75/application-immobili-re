"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import {
  createInvoiceSchema,
  generateInvoiceFromLeaseSchema,
  generateBatchInvoicesSchema,
  createCreditNoteSchema,
  type CreateInvoiceInput,
  type GenerateInvoiceFromLeaseInput,
  type GenerateBatchInvoicesInput,
  type CreateCreditNoteInput,
} from "@/validations/invoice";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";
import {
  computeLines,
  getNextCreditNoteNumber,
  computePeriodDates,
  computeIssueDueDate,
  computeRentForPeriod,
  computeManagementFee,
  buildRevisionProrataLines,
  computeInvoicePreview,
  type InvoicePreview,
} from "./invoice-shared";

const invoiceGenerationExclusionSchema = z.object({
  leaseId: z.string().cuid(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  reason: z.string().trim().min(1).max(500).optional(),
});

const cancelInvoiceGenerationExclusionSchema = z.object({
  exclusionId: z.string().cuid(),
});

const invoicePeriodKey = (leaseId: string, periodStart: Date | null, periodEnd: Date | null) =>
  `${leaseId}:${periodStart?.getTime() ?? "null"}:${periodEnd?.getTime() ?? "null"}`;

export async function createInvoice(
  societyId: string,
  input: CreateInvoiceInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const subCheck = await checkSubscriptionActive(societyId);
    if (!subCheck.active) return { success: false, error: subCheck.message };

    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.data.tenantId, societyId, isActive: true },
    });
    if (!tenant) return { success: false, error: "Locataire introuvable" };

    const computedLines = computeLines(parsed.data.lines);
    const totalHT = computedLines.reduce((s, l) => s + l.totalHT, 0);
    const totalVAT = computedLines.reduce((s, l) => s + l.totalVAT, 0);
    const totalTTC = totalHT + totalVAT;

    const invoice = await prisma.invoice.create({
      data: {
        societyId,
        tenantId: parsed.data.tenantId,
        leaseId: parsed.data.leaseId ?? null,
        invoiceType: parsed.data.invoiceType,
        status: "BROUILLON",
        issueDate: new Date(),
        dueDate: new Date(parsed.data.dueDate),
        periodStart: parsed.data.periodStart ? new Date(parsed.data.periodStart) : null,
        periodEnd: parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null,
        totalHT,
        totalVAT,
        totalTTC,
        lines: { create: computedLines },
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: { totalTTC, tenantId: parsed.data.tenantId },
    });

    revalidatePath("/facturation");
    if (parsed.data.leaseId) revalidatePath(`/baux/${parsed.data.leaseId}`);

    return { success: true, data: { id: invoice.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createInvoice]", error);
    return { success: false, error: "Erreur lors de la création de la facture" };
  }
}

export async function previewInvoiceFromLease(
  societyId: string,
  input: GenerateInvoiceFromLeaseInput
): Promise<ActionResult<InvoicePreview>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = generateInvoiceFromLeaseSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e: { message: string }) => e.message).join(", ") };

    const preview = await computeInvoicePreview(societyId, parsed.data.leaseId, parsed.data.periodMonth);
    if (!preview) return { success: false, error: "Bail actif introuvable" };

    return { success: true, data: preview };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[previewInvoiceFromLease]", error);
    return { success: false, error: "Erreur lors de la prévisualisation" };
  }
}

export async function previewBatchInvoices(
  societyId: string,
  input: GenerateBatchInvoicesInput
): Promise<ActionResult<InvoicePreview[]>> {
  try {
    await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = generateBatchInvoicesSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e: { message: string }) => e.message).join(", ") };

    const leaseIds = parsed.data.leaseIds?.length
      ? parsed.data.leaseIds
      : (await prisma.lease.findMany({ where: { societyId, status: "EN_COURS" }, select: { id: true } })).map((l) => l.id);

    const previews: InvoicePreview[] = [];
    for (const leaseId of leaseIds) {
      const preview = await computeInvoicePreview(societyId, leaseId, parsed.data.periodMonth);
      if (preview) previews.push(preview);
    }

    return { success: true, data: previews };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[previewBatchInvoices]", error);
    return { success: false, error: "Erreur lors de la prévisualisation" };
  }
}

/**
 * Génère un appel de loyer pour un bail sur une période donnée.
 * Inclut les provisions sur charges actives.
 */
export async function generateInvoiceFromLease(
  societyId: string,
  input: GenerateInvoiceFromLeaseInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = generateInvoiceFromLeaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId, status: "EN_COURS" },
      select: {
        id: true,
        tenantId: true,
        startDate: true,
        entryDate: true,
        paymentFrequency: true,
        billingTerm: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        rentFreeMonths: true,
        progressiveRent: true,
        rentSteps: {
          orderBy: { position: "asc" as const },
          select: { startDate: true, endDate: true, rentHT: true },
        },
        isThirdPartyManaged: true,
        managementFeeType: true,
        managementFeeValue: true,
        managementFeeBasis: true,
        managementFeeVatRate: true,
        chargeProvisions: {
          where: { isActive: true },
          select: { monthlyAmount: true, vatRate: true, label: true },
        },
        lot: {
          select: {
            number: true,
            building: { select: { name: true } },
          },
        },
      },
    });

    if (!lease) return { success: false, error: "Bail actif introuvable" };

    const { periodStart, periodEnd } = computePeriodDates(
      parsed.data.periodMonth,
      lease.paymentFrequency
    );

    const existing = await prisma.invoice.findFirst({
      where: {
        societyId,
        leaseId: lease.id,
        invoiceType: "APPEL_LOYER",
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
    });
    if (existing) {
      return {
        success: false,
        error: `Une facture existe déjà pour ce bail sur cette période (${existing.invoiceNumber})`,
      };
    }

    const exclusion = await prisma.invoiceGenerationExclusion.findFirst({
      where: {
        societyId,
        leaseId: lease.id,
        periodStart,
        periodEnd,
      },
      select: { id: true },
    });
    if (exclusion) {
      return {
        success: false,
        error: "Ce bail est marqué comme facturé ailleurs pour cette période",
      };
    }

    const effectiveStart = lease.entryDate ?? lease.startDate;

    let rentHT = computeRentForPeriod(
      lease.startDate,
      lease.currentRentHT,
      lease.progressiveRent,
      lease.rentFreeMonths ?? 0,
      lease.rentSteps,
      lease.entryDate,
      periodStart
    );

    const rfm = lease.rentFreeMonths ?? 0;
    const rfmFloor = Math.floor(rfm);
    const rfmFrac = rfm - rfmFloor;
    const effectiveFirstPaidDate = new Date(effectiveStart);
    effectiveFirstPaidDate.setMonth(effectiveFirstPaidDate.getMonth() + rfmFloor);

    let prorataLabel = "";
    const leaseStartDay = effectiveFirstPaidDate.getDate();
    const isFirstPeriod =
      periodStart.getFullYear() === effectiveFirstPaidDate.getFullYear() &&
      periodStart.getMonth() === effectiveFirstPaidDate.getMonth();
    if (isFirstPeriod && rentHT > 0 && leaseStartDay > 1 && rfmFrac === 0) {
      const y = effectiveFirstPaidDate.getFullYear();
      const m = effectiveFirstPaidDate.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const daysRemaining = daysInMonth - leaseStartDay + 1;
      rentHT = Math.round((rentHT * daysRemaining / daysInMonth) * 100) / 100;
      prorataLabel = ` (prorata ${daysRemaining}/${daysInMonth} j.)`;
    }

    if (rfmFrac > 0 && rentHT > 0) {
      const leaseStartNorm = new Date(effectiveStart);
      leaseStartNorm.setDate(1);
      const monthsSinceLease =
        (periodStart.getFullYear() - leaseStartNorm.getFullYear()) * 12 +
        (periodStart.getMonth() - leaseStartNorm.getMonth());
      if (monthsSinceLease === rfmFloor) {
        const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
        const freeDays = Math.round(rfmFrac * daysInMonth);
        const paidDays = daysInMonth - freeDays;
        rentHT = Math.round((rentHT * paidDays / daysInMonth) * 100) / 100;
        prorataLabel = prorataLabel + " (franchise " + freeDays + "/" + daysInMonth + " j.)";
      }
    }

    const vatRate = lease.vatApplicable ? lease.vatRate : 0;

    const { issueDate, dueDate } = computeIssueDueDate(
      periodStart,
      periodEnd,
      lease.billingTerm
    );

    const lotLabel = lease.lot
      ? `${lease.lot.building.name} – Lot ${lease.lot.number}`
      : "Lot non précisé";

    const periodLabel = periodStart.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });

    const freqMultiplier: Record<string, number> = {
      MENSUEL: 1,
      TRIMESTRIEL: 3,
      SEMESTRIEL: 6,
      ANNUEL: 12,
    };
    const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

    const revisionProrata = await buildRevisionProrataLines(
      lease.id, periodStart, periodEnd, vatRate, lotLabel, periodLabel,
    );

    const invoiceLines: Array<{
      label: string; quantity: number; unitPrice: number;
      vatRate: number; totalHT: number; totalVAT: number; totalTTC: number;
    }> = [];
    if (revisionProrata) {
      invoiceLines.push(...revisionProrata.lines);
      rentHT = revisionProrata.rentHT;
    } else {
      const rentVAT = rentHT * (vatRate / 100);
      invoiceLines.push({
        label: `Loyer ${lotLabel} — ${periodLabel}${prorataLabel}`,
        quantity: 1,
        unitPrice: rentHT,
        vatRate,
        totalHT: rentHT,
        totalVAT: rentVAT,
        totalTTC: rentHT + rentVAT,
      });
    }

    for (const cp of lease.chargeProvisions) {
      const ht = cp.monthlyAmount * mult;
      const cpVatRate = cp.vatRate;
      const vat = ht * (cpVatRate / 100);
      invoiceLines.push({
        label: `${cp.label} — ${periodLabel}`,
        quantity: 1,
        unitPrice: ht,
        vatRate: cpVatRate,
        totalHT: ht,
        totalVAT: vat,
        totalTTC: ht + vat,
      });
    }

    const totalHT = invoiceLines.reduce((s, l) => s + l.totalHT, 0);
    const totalVAT = invoiceLines.reduce((s, l) => s + l.totalVAT, 0);
    const totalTTC = totalHT + totalVAT;

    const invoice = await prisma.invoice.create({
      data: {
        societyId,
        tenantId: lease.tenantId,
        leaseId: lease.id,
        invoiceType: "APPEL_LOYER",
        status: "BROUILLON",
        issueDate,
        dueDate,
        periodStart,
        periodEnd,
        totalHT,
        totalVAT,
        totalTTC,
        lines: { create: invoiceLines },
      },
    });

    if (lease.isThirdPartyManaged) {
      const chargesHT = lease.chargeProvisions.reduce((s, cp) => {
        const m = ({ MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 } as Record<string, number>)[lease.paymentFrequency] ?? 1;
        return s + cp.monthlyAmount * m;
      }, 0);
      const fee = computeManagementFee(lease, rentHT, chargesHT, totalTTC);
      if (fee.feeTTC > 0) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            isThirdPartyManaged: true,
            managementFeeHT: fee.feeHT,
            managementFeeVAT: fee.feeVAT,
            managementFeeTTC: fee.feeTTC,
            expectedNetAmount: Math.round((totalTTC - fee.feeTTC) * 100) / 100,
          },
        });
      }
    }

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: {
        totalTTC,
        leaseId: lease.id,
        periodMonth: parsed.data.periodMonth,
        generated: true,
      },
    });

    revalidatePath("/facturation");
    revalidatePath(`/baux/${lease.id}`);

    return { success: true, data: { id: invoice.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[generateInvoiceFromLease]", error);
    return { success: false, error: "Erreur lors de la génération de la facture" };
  }
}

/**
 * Génère les appels de loyers en masse pour tous les baux actifs.
 */
export async function generateBatchInvoices(
  societyId: string,
  input: GenerateBatchInvoicesInput
): Promise<ActionResult<{ created: number; skipped: number; errors: string[] }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = generateBatchInvoicesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const leases = await prisma.lease.findMany({
      where: {
        societyId,
        status: "EN_COURS",
        ...(parsed.data.leaseIds?.length
          ? { id: { in: parsed.data.leaseIds } }
          : {}),
      },
      select: {
        id: true,
        tenantId: true,
        startDate: true,
        entryDate: true,
        paymentFrequency: true,
        billingTerm: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        rentFreeMonths: true,
        progressiveRent: true,
        rentSteps: {
          orderBy: { position: "asc" as const },
          select: { startDate: true, endDate: true, rentHT: true },
        },
        chargeProvisions: {
          where: { isActive: true },
          select: { monthlyAmount: true, vatRate: true, label: true },
        },
        lot: {
          select: {
            number: true,
            building: { select: { name: true } },
          },
        },
      },
    });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Calcul des périodes par bail (varie selon la fréquence de paiement)
    const leaseWithPeriods = leases.map((lease) => ({
      lease,
      ...computePeriodDates(parsed.data.periodMonth, lease.paymentFrequency),
    }));

    // Vérification de doublons en 1 requête groupée (au lieu de N requêtes)
    const periodStarts = leaseWithPeriods.map((l) => l.periodStart.getTime());
    const periodEnds = leaseWithPeriods.map((l) => l.periodEnd.getTime());
    const existingInvoices = leaseWithPeriods.length > 0
      ? await prisma.invoice.findMany({
          where: {
            societyId,
            leaseId: { in: leaseWithPeriods.map((l) => l.lease.id) },
            invoiceType: "APPEL_LOYER",
            periodStart: { gte: new Date(Math.min(...periodStarts)) },
            periodEnd: { lte: new Date(Math.max(...periodEnds)) },
          },
          select: { leaseId: true, periodStart: true, periodEnd: true },
        })
      : [];
    const existingExclusions = leaseWithPeriods.length > 0
      ? await prisma.invoiceGenerationExclusion.findMany({
          where: {
            societyId,
            leaseId: { in: leaseWithPeriods.map((l) => l.lease.id) },
            periodStart: { gte: new Date(Math.min(...periodStarts)) },
            periodEnd: { lte: new Date(Math.max(...periodEnds)) },
          },
          select: { leaseId: true, periodStart: true, periodEnd: true },
        })
      : [];
    const alreadyInvoicedPeriods = new Set(
      existingInvoices
        .filter((inv) => inv.leaseId)
        .map((inv) => invoicePeriodKey(inv.leaseId!, inv.periodStart, inv.periodEnd))
    );
    const excludedPeriods = new Set(
      existingExclusions.map((exclusion) =>
        invoicePeriodKey(exclusion.leaseId, exclusion.periodStart, exclusion.periodEnd)
      )
    );

    for (const { lease, periodStart, periodEnd } of leaseWithPeriods) {
      try {
        const periodKey = invoicePeriodKey(lease.id, periodStart, periodEnd);
        if (alreadyInvoicedPeriods.has(periodKey) || excludedPeriods.has(periodKey)) {
          skipped++;
          continue;
        }

        const batchEffectiveStart = lease.entryDate ?? lease.startDate;

        let rentHT = computeRentForPeriod(
          lease.startDate,
          lease.currentRentHT,
          lease.progressiveRent,
          lease.rentFreeMonths ?? 0,
          lease.rentSteps,
          lease.entryDate,
          periodStart
        );

        const batchRfm = lease.rentFreeMonths ?? 0;
        const batchRfmFloor = Math.floor(batchRfm);
        const batchRfmFrac = batchRfm - batchRfmFloor;
        const batchEffectiveFirstPaidDate = new Date(batchEffectiveStart);
        batchEffectiveFirstPaidDate.setMonth(batchEffectiveFirstPaidDate.getMonth() + batchRfmFloor);

        let batchProrataLabel = "";
        const batchLeaseStartDay = batchEffectiveFirstPaidDate.getDate();
        const batchIsFirstPeriod =
          periodStart.getFullYear() === batchEffectiveFirstPaidDate.getFullYear() &&
          periodStart.getMonth() === batchEffectiveFirstPaidDate.getMonth();
        if (batchIsFirstPeriod && rentHT > 0 && batchLeaseStartDay > 1 && batchRfmFrac === 0) {
          const y = batchEffectiveFirstPaidDate.getFullYear();
          const m = batchEffectiveFirstPaidDate.getMonth();
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const daysRemaining = daysInMonth - batchLeaseStartDay + 1;
          rentHT = Math.round((rentHT * daysRemaining / daysInMonth) * 100) / 100;
          batchProrataLabel = " (prorata " + daysRemaining + "/" + daysInMonth + " j.)";
        }
        if (batchRfmFrac > 0 && rentHT > 0) {
          const batchLeaseStartNorm = new Date(batchEffectiveStart);
          batchLeaseStartNorm.setDate(1);
          const batchMonthsSince =
            (periodStart.getFullYear() - batchLeaseStartNorm.getFullYear()) * 12 +
            (periodStart.getMonth() - batchLeaseStartNorm.getMonth());
          if (batchMonthsSince === batchRfmFloor) {
            const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
            const freeDays = Math.round(batchRfmFrac * daysInMonth);
            const paidDays = daysInMonth - freeDays;
            rentHT = Math.round((rentHT * paidDays / daysInMonth) * 100) / 100;
            batchProrataLabel = batchProrataLabel + " (franchise " + freeDays + "/" + daysInMonth + " j.)";
          }
        }

        const vatRate = lease.vatApplicable ? lease.vatRate : 0;

        const { issueDate, dueDate } = computeIssueDueDate(
          periodStart,
          periodEnd,
          lease.billingTerm
        );

        const lotLabel = lease.lot
          ? `${lease.lot.building.name} – Lot ${lease.lot.number}`
          : "Lot non précisé";

        const periodLabel = periodStart.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });

        const freqMultiplier: Record<string, number> = {
          MENSUEL: 1,
          TRIMESTRIEL: 3,
          SEMESTRIEL: 6,
          ANNUEL: 12,
        };
        const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

        const revisionProrata = await buildRevisionProrataLines(
          lease.id, periodStart, periodEnd, vatRate, lotLabel, periodLabel,
        );

        const invoiceLines: Array<{
          label: string; quantity: number; unitPrice: number;
          vatRate: number; totalHT: number; totalVAT: number; totalTTC: number;
        }> = [];
        if (revisionProrata) {
          invoiceLines.push(...revisionProrata.lines);
        } else {
          const rentVAT = rentHT * (vatRate / 100);
          invoiceLines.push({
            label: `Loyer ${lotLabel} — ${periodLabel}${batchProrataLabel}`,
            quantity: 1,
            unitPrice: rentHT,
            vatRate,
            totalHT: rentHT,
            totalVAT: rentVAT,
            totalTTC: rentHT + rentVAT,
          });
        }

        for (const cp of lease.chargeProvisions) {
          const ht = cp.monthlyAmount * mult;
          const cpVatRate = cp.vatRate;
          const vat = ht * (cpVatRate / 100);
          invoiceLines.push({
            label: `${cp.label} — ${periodLabel}`,
            quantity: 1,
            unitPrice: ht,
            vatRate: cpVatRate,
            totalHT: ht,
            totalVAT: vat,
            totalTTC: ht + vat,
          });
        }

        const totalHT = invoiceLines.reduce((s, l) => s + l.totalHT, 0);
        const totalVAT = invoiceLines.reduce((s, l) => s + l.totalVAT, 0);
        const totalTTC = totalHT + totalVAT;

        await prisma.invoice.create({
          data: {
            societyId,
            tenantId: lease.tenantId,
            leaseId: lease.id,
            invoiceType: "APPEL_LOYER",
            status: "BROUILLON",
            issueDate,
            dueDate,
            periodStart,
            periodEnd,
            totalHT,
            totalVAT,
            totalTTC,
            lines: { create: invoiceLines },
          },
        });

        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        errors.push(`Bail ${lease.id} : ${msg}`);
      }
    }

    if (created > 0) {
      await createAuditLog({
        societyId,
        userId: context.userId,
        action: "CREATE",
        entity: "Invoice",
        entityId: societyId,
        details: {
          batch: true,
          periodMonth: parsed.data.periodMonth,
          created,
          skipped,
        },
      });
      revalidatePath("/facturation");
    }

    return { success: true, data: { created, skipped, errors } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[generateBatchInvoices]", error);
    return { success: false, error: "Erreur lors de la génération en masse" };
  }
}

export async function excludeInvoiceGenerationPeriod(
  societyId: string,
  input: z.infer<typeof invoiceGenerationExclusionSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = invoiceGenerationExclusionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const lease = await prisma.lease.findFirst({
      where: {
        id: parsed.data.leaseId,
        societyId,
        status: "EN_COURS",
      },
      select: {
        id: true,
        paymentFrequency: true,
      },
    });
    if (!lease) return { success: false, error: "Bail actif introuvable" };

    const { periodStart, periodEnd } = computePeriodDates(
      parsed.data.periodMonth,
      lease.paymentFrequency
    );
    const reason = parsed.data.reason?.trim() || "Facturé dans un autre logiciel";

    const exclusion = await prisma.invoiceGenerationExclusion.upsert({
      where: {
        societyId_leaseId_periodStart_periodEnd: {
          societyId,
          leaseId: lease.id,
          periodStart,
          periodEnd,
        },
      },
      update: {
        reason,
        createdBy: context.userId,
      },
      create: {
        societyId,
        leaseId: lease.id,
        periodStart,
        periodEnd,
        reason,
        createdBy: context.userId,
      },
      select: { id: true },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "InvoiceGenerationExclusion",
      entityId: exclusion.id,
      details: {
        leaseId: lease.id,
        periodMonth: parsed.data.periodMonth,
        periodStart,
        periodEnd,
        reason,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/facturation");
    revalidatePath("/facturation/generer");

    return { success: true, data: { id: exclusion.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[excludeInvoiceGenerationPeriod]", error);
    return { success: false, error: "Erreur lors de l'exclusion de la période" };
  }
}

export async function cancelInvoiceGenerationExclusion(
  societyId: string,
  input: z.infer<typeof cancelInvoiceGenerationExclusionSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = cancelInvoiceGenerationExclusionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const exclusion = await prisma.invoiceGenerationExclusion.findFirst({
      where: {
        id: parsed.data.exclusionId,
        societyId,
      },
      select: {
        id: true,
        leaseId: true,
        periodStart: true,
        periodEnd: true,
        reason: true,
      },
    });
    if (!exclusion) return { success: false, error: "Exclusion introuvable" };

    await prisma.invoiceGenerationExclusion.delete({
      where: { id: exclusion.id },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "DELETE",
      entity: "InvoiceGenerationExclusion",
      entityId: exclusion.id,
      details: {
        leaseId: exclusion.leaseId,
        periodStart: exclusion.periodStart,
        periodEnd: exclusion.periodEnd,
        reason: exclusion.reason,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/facturation");
    revalidatePath("/facturation/generer");

    return { success: true, data: { id: exclusion.id } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[cancelInvoiceGenerationExclusion]", error);
    return { success: false, error: "Erreur lors de la réactivation de la période" };
  }
}

/**
 * Actualise un brouillon d'appel de loyer avec les paramètres actuels du bail.
 * Supprime et recrée les lignes ; met à jour les totaux.
 */
export async function refreshDraftInvoice(
  societyId: string,
  invoiceId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, societyId },
      select: {
        id: true,
        status: true,
        invoiceType: true,
        leaseId: true,
        periodStart: true,
        periodEnd: true,
      },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };
    if (invoice.status !== "BROUILLON") return { success: false, error: "Seuls les brouillons peuvent être actualisés" };
    if (invoice.invoiceType !== "APPEL_LOYER") return { success: false, error: "Seuls les appels de loyer peuvent être actualisés" };
    if (!invoice.leaseId) return { success: false, error: "Ce brouillon n'est pas associé à un bail" };
    if (!invoice.periodStart) return { success: false, error: "Période de facturation manquante" };

    const periodStart = new Date(invoice.periodStart);

    const lease = await prisma.lease.findFirst({
      where: { id: invoice.leaseId, societyId },
      select: {
        id: true,
        tenantId: true,
        startDate: true,
        entryDate: true,
        paymentFrequency: true,
        billingTerm: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        rentFreeMonths: true,
        progressiveRent: true,
        rentSteps: {
          orderBy: { position: "asc" as const },
          select: { startDate: true, endDate: true, rentHT: true },
        },
        isThirdPartyManaged: true,
        managementFeeType: true,
        managementFeeValue: true,
        managementFeeBasis: true,
        managementFeeVatRate: true,
        chargeProvisions: {
          where: {
            isActive: true,
            startDate: { lte: periodStart },
            OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
          },
          select: { monthlyAmount: true, vatRate: true, label: true },
        },
        lot: {
          select: { number: true, building: { select: { name: true } } },
        },
      },
    });
    if (!lease) return { success: false, error: "Bail introuvable" };
    const periodEnd = computePeriodDates(
      `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
      lease.paymentFrequency,
    ).periodEnd;

    const effectiveStart = lease.entryDate ?? lease.startDate;

    let rentHT = computeRentForPeriod(
      lease.startDate,
      lease.currentRentHT,
      lease.progressiveRent,
      lease.rentFreeMonths ?? 0,
      lease.rentSteps,
      lease.entryDate,
      periodStart
    );

    const rfm = lease.rentFreeMonths ?? 0;
    const rfmFloor = Math.floor(rfm);
    const rfmFrac = rfm - rfmFloor;
    const effectiveFirstPaidDate = new Date(effectiveStart);
    effectiveFirstPaidDate.setMonth(effectiveFirstPaidDate.getMonth() + rfmFloor);

    let prorataLabel = "";
    const leaseStartDay = effectiveFirstPaidDate.getDate();
    const isFirstPeriod =
      periodStart.getFullYear() === effectiveFirstPaidDate.getFullYear() &&
      periodStart.getMonth() === effectiveFirstPaidDate.getMonth();
    if (isFirstPeriod && rentHT > 0 && leaseStartDay > 1 && rfmFrac === 0) {
      const y = effectiveFirstPaidDate.getFullYear();
      const m = effectiveFirstPaidDate.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const daysRemaining = daysInMonth - leaseStartDay + 1;
      rentHT = Math.round((rentHT * daysRemaining / daysInMonth) * 100) / 100;
      prorataLabel = ` (prorata ${daysRemaining}/${daysInMonth} j.)`;
    }

    if (rfmFrac > 0 && rentHT > 0) {
      const leaseStartNorm = new Date(effectiveStart);
      leaseStartNorm.setDate(1);
      const monthsSinceLease =
        (periodStart.getFullYear() - leaseStartNorm.getFullYear()) * 12 +
        (periodStart.getMonth() - leaseStartNorm.getMonth());
      if (monthsSinceLease === rfmFloor) {
        const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
        const freeDays = Math.round(rfmFrac * daysInMonth);
        const paidDays = daysInMonth - freeDays;
        rentHT = Math.round((rentHT * paidDays / daysInMonth) * 100) / 100;
        prorataLabel = prorataLabel + " (franchise " + freeDays + "/" + daysInMonth + " j.)";
      }
    }

    const vatRate = lease.vatApplicable ? lease.vatRate : 0;
    const { issueDate, dueDate } = computeIssueDueDate(periodStart, periodEnd, lease.billingTerm);
    const lotLabel = lease.lot ? `${lease.lot.building.name} – Lot ${lease.lot.number}` : "Lot non précisé";
    const periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const freqMultiplier: Record<string, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };
    const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

    const revisionProrata = await buildRevisionProrataLines(lease.id, periodStart, periodEnd, vatRate, lotLabel, periodLabel);

    const invoiceLines: Array<{
      label: string; quantity: number; unitPrice: number;
      vatRate: number; totalHT: number; totalVAT: number; totalTTC: number;
    }> = [];

    if (revisionProrata) {
      invoiceLines.push(...revisionProrata.lines);
      rentHT = revisionProrata.rentHT;
    } else {
      const rentVAT = rentHT * (vatRate / 100);
      invoiceLines.push({
        label: `Loyer ${lotLabel} — ${periodLabel}${prorataLabel}`,
        quantity: 1, unitPrice: rentHT, vatRate,
        totalHT: rentHT, totalVAT: rentVAT, totalTTC: rentHT + rentVAT,
      });
    }

    for (const cp of lease.chargeProvisions) {
      const ht = cp.monthlyAmount * mult;
      const cpVatRate = cp.vatRate;
      const vat = ht * (cpVatRate / 100);
      invoiceLines.push({
        label: `${cp.label} — ${periodLabel}`,
        quantity: 1, unitPrice: ht, vatRate: cpVatRate,
        totalHT: ht, totalVAT: vat, totalTTC: ht + vat,
      });
    }

    const totalHT = invoiceLines.reduce((s, l) => s + l.totalHT, 0);
    const totalVAT = invoiceLines.reduce((s, l) => s + l.totalVAT, 0);
    const totalTTC = totalHT + totalVAT;

    let managementFeeData: {
      isThirdPartyManaged: boolean;
      managementFeeHT?: number;
      managementFeeVAT?: number;
      managementFeeTTC?: number;
      expectedNetAmount?: number;
    } = { isThirdPartyManaged: false };

    if (lease.isThirdPartyManaged) {
      const chargesHT = lease.chargeProvisions.reduce((s, cp) => s + cp.monthlyAmount * mult, 0);
      const fee = computeManagementFee(lease, rentHT, chargesHT, totalTTC);
      if (fee.feeTTC > 0) {
        managementFeeData = {
          isThirdPartyManaged: true,
          managementFeeHT: fee.feeHT,
          managementFeeVAT: fee.feeVAT,
          managementFeeTTC: fee.feeTTC,
          expectedNetAmount: Math.round((totalTTC - fee.feeTTC) * 100) / 100,
        };
      }
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        issueDate,
        dueDate,
        periodEnd,
        totalHT,
        totalVAT,
        totalTTC,
        ...managementFeeData,
        lines: { deleteMany: {}, create: invoiceLines },
      },
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      details: { refreshed: true, totalTTC, leaseId: lease.id },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${invoiceId}`);
    revalidatePath(`/baux/${lease.id}`);

    return { success: true, data: { id: invoiceId } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[refreshDraftInvoice]", error);
    return { success: false, error: "Erreur lors de l'actualisation du brouillon" };
  }
}

/**
 * Émet un avoir annulant intégralement une facture d'origine.
 */
export async function createCreditNote(
  societyId: string,
  input: CreateCreditNoteInput
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  try {
    const context = await requireSocietyActionContext(societyId, "COMPTABLE");

    const parsed = createCreditNoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e: { message: string }) => e.message).join(", "),
      };
    }

    const original = await prisma.invoice.findFirst({
      where: { id: parsed.data.originalInvoiceId, societyId },
      include: { lines: true },
    });
    if (!original) return { success: false, error: "Facture originale introuvable" };
    if (original.invoiceType === "AVOIR")
      return { success: false, error: "Impossible d'émettre un avoir sur un avoir" };

    const existingCreditNote = await prisma.invoice.findFirst({
      where: { creditNoteForId: original.id },
    });
    if (existingCreditNote) {
      return {
        success: false,
        error: `Un avoir existe déjà pour cette facture (${existingCreditNote.invoiceNumber})`,
      };
    }

    const creditNoteLines = original.lines.map((l) => ({
      label: l.label,
      quantity: l.quantity,
      unitPrice: -l.unitPrice,
      vatRate: l.vatRate,
      totalHT: -l.totalHT,
      totalVAT: -l.totalVAT,
      totalTTC: -l.totalTTC,
    }));

    const creditNote = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await getNextCreditNoteNumber(societyId, tx);
      return tx.invoice.create({
        data: {
          societyId,
          tenantId: original.tenantId,
          leaseId: original.leaseId,
          creditNoteForId: original.id,
          invoiceNumber,
          invoiceType: "AVOIR",
          status: "BROUILLON",
          issueDate: new Date(),
          dueDate: new Date(parsed.data.dueDate),
          periodStart: original.periodStart,
          periodEnd: original.periodEnd,
          totalHT: -original.totalHT,
          totalVAT: -original.totalVAT,
          totalTTC: -original.totalTTC,
          lines: { create: creditNoteLines },
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: context.userId,
      action: "CREATE",
      entity: "Invoice",
      entityId: creditNote.id,
      details: {
        invoiceNumber: creditNote.invoiceNumber,
        creditNoteFor: original.invoiceNumber,
        reason: parsed.data.reason,
      },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${original.id}`);

    return { success: true, data: { id: creditNote.id, invoiceNumber: creditNote.invoiceNumber! } };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError)
      return { success: false, error: error.message };
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[createCreditNote]", error);
    return { success: false, error: "Erreur lors de l'émission de l'avoir" };
  }
}
