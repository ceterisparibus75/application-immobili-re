"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSocietyAccess, ForbiddenError } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createInvoiceSchema,
  recordPaymentSchema,
  generateInvoiceFromLeaseSchema,
  generateBatchInvoicesSchema,
  createCreditNoteSchema,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type GenerateInvoiceFromLeaseInput,
  type GenerateBatchInvoicesInput,
  type CreateCreditNoteInput,
} from "@/validations/invoice";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/society";
import type { PaymentFrequency, BillingTerm, Prisma } from "@prisma/client";

function computeLines(
  lines: { label: string; quantity: number; unitPrice: number; vatRate: number }[]
) {
  return lines.map((line) => {
    const totalHT = line.quantity * line.unitPrice;
    const totalVAT = totalHT * (line.vatRate / 100);
    return {
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      totalHT,
      totalVAT,
      totalTTC: totalHT + totalVAT,
    };
  });
}

/** Numérotation atomique — incrémente le compteur dans la transaction. */
async function getNextInvoiceNumber(
  societyId: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const society = await tx.society.update({
    where: { id: societyId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true, invoicePrefix: true },
  });
  const year = new Date().getFullYear();
  const prefix = (society.invoicePrefix?.toUpperCase() || "FAC");
  return `${prefix}-${year}-${String(society.nextInvoiceNumber).padStart(4, "0")}`;
}

export async function createInvoice(
  societyId: string,
  input: CreateInvoiceInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
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

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await getNextInvoiceNumber(societyId, tx);
      return tx.invoice.create({
        data: {
          societyId,
          tenantId: parsed.data.tenantId,
          leaseId: parsed.data.leaseId ?? null,
          invoiceNumber,
          invoiceType: parsed.data.invoiceType,
          status: "EN_ATTENTE",
          issueDate: new Date(parsed.data.issueDate),
          dueDate: new Date(parsed.data.dueDate),
          periodStart: parsed.data.periodStart ? new Date(parsed.data.periodStart) : null,
          periodEnd: parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : null,
          totalHT,
          totalVAT,
          totalTTC,
          lines: { create: computedLines },
        },
      });
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: { invoiceNumber: invoice.invoiceNumber, totalTTC, tenantId: parsed.data.tenantId },
    });

    revalidatePath("/facturation");
    if (parsed.data.leaseId) revalidatePath(`/baux/${parsed.data.leaseId}`);

    return { success: true, data: { id: invoice.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[createInvoice]", error);
    return { success: false, error: "Erreur lors de la création de la facture" };
  }
}

export async function recordPayment(
  societyId: string,
  input: RecordPaymentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: parsed.data.invoiceId, societyId },
      include: { payments: true },
    });
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const payment = await prisma.payment.create({
      data: {
        invoiceId: parsed.data.invoiceId,
        amount: parsed.data.amount,
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method ?? null,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    const totalPaid =
      invoice.payments.reduce((s, p) => s + p.amount, 0) + parsed.data.amount;
    let newStatus: "EN_ATTENTE" | "PAYE" | "PARTIELLEMENT_PAYE" | "EN_RETARD" | "LITIGIEUX" =
      "EN_ATTENTE";
    if (totalPaid >= invoice.totalTTC) {
      newStatus = "PAYE";
    } else if (totalPaid > 0) {
      newStatus = "PARTIELLEMENT_PAYE";
    }

    await prisma.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: { status: newStatus },
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Invoice",
      entityId: parsed.data.invoiceId,
      details: { paymentAmount: parsed.data.amount, newStatus },
    });

    revalidatePath("/facturation");
    revalidatePath(`/facturation/${parsed.data.invoiceId}`);

    return { success: true, data: { id: payment.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[recordPayment]", error);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  }
}

export async function getInvoices(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.invoice.findMany({
    where: { societyId },
    include: {
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: { select: { payments: true } },
    },
    orderBy: [{ dueDate: "desc" }],
  });
}

export async function getInvoiceById(societyId: string, invoiceId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  await requireSocietyAccess(session.user.id, societyId);

  return prisma.invoice.findFirst({
    where: { id: invoiceId, societyId },
    include: {
      tenant: true,
      society: {
        select: {
          name: true,
          siret: true,
          vatNumber: true,
          vatRegime: true,
          logoUrl: true,
          legalMentions: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
        },
      },
      lease: {
        select: {
          id: true,
          lot: {
            select: {
              number: true,
              building: { select: { name: true, city: true } },
            },
          },
        },
      },
      lines: true,
      payments: { orderBy: { paidAt: "desc" } },
      creditNoteFor: { select: { id: true, invoiceNumber: true } },
      creditNotes: { select: { id: true, invoiceNumber: true } },
    },
  });
}

// ============================================================
// GÉNÉRATION AUTOMATIQUE DES FACTURES
// ============================================================

/** Calcule les dates de début/fin d'une période à partir d'un mois (ex: "2025-01"). */
function computePeriodDates(
  periodMonth: string,
  frequency: PaymentFrequency
): { periodStart: Date; periodEnd: Date } {
  const [y, m] = periodMonth.split("-").map(Number);

  switch (frequency) {
    case "TRIMESTRIEL": {
      const q = Math.floor((m - 1) / 3);
      return {
        periodStart: new Date(y, q * 3, 1),
        periodEnd: new Date(y, q * 3 + 3, 0),
      };
    }
    case "SEMESTRIEL": {
      const s = Math.floor((m - 1) / 6);
      return {
        periodStart: new Date(y, s * 6, 1),
        periodEnd: new Date(y, s * 6 + 6, 0),
      };
    }
    case "ANNUEL":
      return {
        periodStart: new Date(y, 0, 1),
        periodEnd: new Date(y, 12, 0),
      };
    default: // MENSUEL
      return {
        periodStart: new Date(y, m - 1, 1),
        periodEnd: new Date(y, m, 0),
      };
  }
}

/** Détermine la date d'émission et l'échéance selon le terme. */
function computeIssueDueDate(
  periodStart: Date,
  periodEnd: Date,
  billingTerm: BillingTerm
): { issueDate: Date; dueDate: Date } {
  if (billingTerm === "A_ECHOIR") {
    return { issueDate: periodStart, dueDate: periodStart };
  }
  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() + 1);
  return { issueDate: periodEnd, dueDate };
}

/**
 * Calcule le loyer applicable pour une période donnée.
 */
function computeRentForPeriod(
  startDate: Date,
  currentRentHT: number,
  progressiveRent: unknown,
  rentFreeMonths: number
): number {
  const start = new Date(startDate);
  start.setDate(1);
  const now = new Date();
  now.setDate(1);
  const monthsSinceStart =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  if (monthsSinceStart < rentFreeMonths) return 0;

  const progressive = progressiveRent as
    | Array<{ months: number; rentHT: number }>
    | null;
  if (progressive && progressive.length > 0) {
    let cumulative = 0;
    for (const period of progressive) {
      cumulative += period.months;
      if (monthsSinceStart < cumulative) return period.rentHT;
    }
  }

  return currentRentHT;
}

/**
 * Retourne les baux actifs avec les infos nécessaires pour la facturation.
 */
export async function getActiveLeasesForInvoicing(societyId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.lease.findMany({
    where: { societyId, status: "EN_COURS" },
    select: {
      id: true,
      startDate: true,
      paymentFrequency: true,
      billingTerm: true,
      currentRentHT: true,
      baseRentHT: true,
      vatApplicable: true,
      vatRate: true,
      rentFreeMonths: true,
      progressiveRent: true,
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          mobile: true,
        },
      },
      lot: {
        select: {
          number: true,
          building: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: [
      { lot: { building: { name: "asc" } } },
      { tenant: { lastName: "asc" } },
    ],
  });
}

/**
 * Récupère les données d'un bail pour pré-remplir le formulaire de facturation.
 */
export async function getLeaseForInvoice(societyId: string, leaseId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  await requireSocietyAccess(session.user.id, societyId);

  return prisma.lease.findFirst({
    where: { id: leaseId, societyId, status: "EN_COURS" },
    select: {
      id: true,
      startDate: true,
      paymentFrequency: true,
      billingTerm: true,
      currentRentHT: true,
      vatApplicable: true,
      vatRate: true,
      rentFreeMonths: true,
      progressiveRent: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
      },
      lot: {
        select: {
          number: true,
          building: { select: { name: true, city: true } },
        },
      },
    },
  });
}

// ============================================================
// PRÉVISUALISATION (sans écriture en base)
// ============================================================

export type InvoicePreviewLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
};

export type InvoicePreviewSociety = {
  name: string;
  logoUrl: string | null;
  siret: string | null;
  vatNumber: string | null;
  vatRegime: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  legalMentions: string | null;
};

export type InvoicePreview = {
  leaseId: string;
  tenantName: string;
  tenantAddress: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  lotLabel: string;
  periodLabel: string;
  issueDate: string;
  dueDate: string;
  lines: InvoicePreviewLine[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  alreadyExists: boolean;
  society: InvoicePreviewSociety | null;
};

/** Calcule les lignes d'une facture sans la créer. */
async function computeInvoicePreview(
  societyId: string,
  leaseId: string,
  periodMonth: string
): Promise<InvoicePreview | null> {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, societyId, status: "EN_COURS" },
    select: {
      id: true,
      tenantId: true,
      startDate: true,
      paymentFrequency: true,
      billingTerm: true,
      currentRentHT: true,
      vatApplicable: true,
      vatRate: true,
      rentFreeMonths: true,
      progressiveRent: true,
      chargeProvisions: { where: { isActive: true }, select: { monthlyAmount: true, vatRate: true, label: true } },
      tenant: {
        select: {
          entityType: true,
          companyName: true,
          firstName: true,
          lastName: true,
          personalAddress: true,
          companyAddress: true,
          email: true,
          billingEmail: true,
          phone: true,
        },
      },
      lot: {
        select: { number: true, building: { select: { name: true } } },
      },
    },
  });
  if (!lease) return null;

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: {
      name: true,
      logoUrl: true,
      siret: true,
      vatNumber: true,
      vatRegime: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      legalMentions: true,
    },
  });

  const { periodStart, periodEnd } = computePeriodDates(periodMonth, lease.paymentFrequency);
  const { issueDate, dueDate } = computeIssueDueDate(periodStart, periodEnd, lease.billingTerm);
  const rentHT = computeRentForPeriod(
    lease.startDate,
    lease.currentRentHT,
    lease.progressiveRent,
    lease.rentFreeMonths ?? 0
  );
  const vatRate = lease.vatApplicable ? lease.vatRate : 0;
  const freqMultiplier: Record<string, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };
  const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

  const lotLabel = lease.lot
    ? `${lease.lot.building.name} – Lot ${lease.lot.number}`
    : "Lot non précisé";
  const periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const tenantName =
    lease.tenant.entityType === "PERSONNE_MORALE"
      ? (lease.tenant.companyName ?? "—")
      : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";

  const rentVAT = rentHT * (vatRate / 100);
  const lines: InvoicePreviewLine[] = [
    {
      label: `Loyer ${lotLabel} — ${periodLabel}`,
      quantity: 1,
      unitPrice: rentHT,
      vatRate,
      totalHT: rentHT,
      totalVAT: rentVAT,
      totalTTC: rentHT + rentVAT,
    },
  ];
  for (const cp of lease.chargeProvisions) {
    const ht = cp.monthlyAmount * mult;
    const cpVatRate = cp.vatRate;
    const vat = ht * (cpVatRate / 100);
    lines.push({
      label: `${cp.label} — ${periodLabel}`,
      quantity: 1,
      unitPrice: ht,
      vatRate: cpVatRate,
      totalHT: ht,
      totalVAT: vat,
      totalTTC: ht + vat,
    });
  }

  const totalHT = lines.reduce((s, l) => s + l.totalHT, 0);
  const totalVAT = lines.reduce((s, l) => s + l.totalVAT, 0);

  // Vérifier si une facture existe déjà pour ce bail+période
  const existing = await prisma.invoice.findFirst({
    where: {
      societyId,
      leaseId: lease.id,
      invoiceType: "APPEL_LOYER",
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
  });

  const tenantAddress =
    lease.tenant.entityType === "PERSONNE_MORALE"
      ? (lease.tenant.companyAddress ?? null)
      : (lease.tenant.personalAddress ?? null);

  return {
    leaseId: lease.id,
    tenantName,
    tenantAddress,
    tenantEmail: lease.tenant.billingEmail || lease.tenant.email || null,
    tenantPhone: lease.tenant.phone ?? null,
    lotLabel,
    periodLabel,
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    lines,
    totalHT,
    totalVAT,
    totalTTC: totalHT + totalVAT,
    alreadyExists: !!existing,
    society: society ?? null,
  };
}

export async function previewInvoiceFromLease(
  societyId: string,
  input: GenerateInvoiceFromLeaseInput
): Promise<ActionResult<InvoicePreview>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = generateInvoiceFromLeaseSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

    const preview = await computeInvoicePreview(societyId, parsed.data.leaseId, parsed.data.periodMonth);
    if (!preview) return { success: false, error: "Bail actif introuvable" };

    return { success: true, data: preview };
  } catch (error) {
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
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = generateBatchInvoicesSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors.map((e) => e.message).join(", ") };

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
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = generateInvoiceFromLeaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
      };
    }

    const lease = await prisma.lease.findFirst({
      where: { id: parsed.data.leaseId, societyId, status: "EN_COURS" },
      select: {
        id: true,
        tenantId: true,
        startDate: true,
        paymentFrequency: true,
        billingTerm: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        rentFreeMonths: true,
        progressiveRent: true,
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

    const rentHT = computeRentForPeriod(
      lease.startDate,
      lease.currentRentHT,
      lease.progressiveRent,
      lease.rentFreeMonths ?? 0
    );

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

    // Multiplicateur selon fréquence de paiement
    const freqMultiplier: Record<string, number> = {
      MENSUEL: 1,
      TRIMESTRIEL: 3,
      SEMESTRIEL: 6,
      ANNUEL: 12,
    };
    const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

    // Ligne de loyer
    const rentVAT = rentHT * (vatRate / 100);
    const invoiceLines = [
      {
        label: `Loyer ${lotLabel} — ${periodLabel}`,
        quantity: 1,
        unitPrice: rentHT,
        vatRate,
        totalHT: rentHT,
        totalVAT: rentVAT,
        totalTTC: rentHT + rentVAT,
      },
    ];

    // Lignes de provisions sur charges (chaque provision a son propre taux de TVA)
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

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await getNextInvoiceNumber(societyId, tx);
      return tx.invoice.create({
        data: {
          societyId,
          tenantId: lease.tenantId,
          leaseId: lease.id,
          invoiceNumber,
          invoiceType: "APPEL_LOYER",
          status: "EN_ATTENTE",
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
    });

    await createAuditLog({
      societyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        totalTTC,
        leaseId: lease.id,
        periodMonth: parsed.data.periodMonth,
        generated: true,
      },
    });

    revalidatePath("/facturation");
    revalidatePath(`/baux/${lease.id}`);

    return { success: true, data: { id: invoice.id, invoiceNumber: invoice.invoiceNumber } };
  } catch (error) {
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
): Promise<
  ActionResult<{ created: number; skipped: number; errors: string[] }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = generateBatchInvoicesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
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
        paymentFrequency: true,
        billingTerm: true,
        currentRentHT: true,
        vatApplicable: true,
        vatRate: true,
        rentFreeMonths: true,
        progressiveRent: true,
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

    for (const lease of leases) {
      try {
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
          skipped++;
          continue;
        }

        const rentHT = computeRentForPeriod(
          lease.startDate,
          lease.currentRentHT,
          lease.progressiveRent,
          lease.rentFreeMonths ?? 0
        );

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

        const rentVAT = rentHT * (vatRate / 100);
        const invoiceLines = [
          {
            label: `Loyer ${lotLabel} — ${periodLabel}`,
            quantity: 1,
            unitPrice: rentHT,
            vatRate,
            totalHT: rentHT,
            totalVAT: rentVAT,
            totalTTC: rentHT + rentVAT,
          },
        ];

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

        await prisma.$transaction(async (tx) => {
          const invoiceNumber = await getNextInvoiceNumber(societyId, tx);
          await tx.invoice.create({
            data: {
              societyId,
              tenantId: lease.tenantId,
              leaseId: lease.id,
              invoiceNumber,
              invoiceType: "APPEL_LOYER",
              status: "EN_ATTENTE",
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
        userId: session.user.id,
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
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[generateBatchInvoices]", error);
    return { success: false, error: "Erreur lors de la génération en masse" };
  }
}

// ============================================================
// AVOIR
// ============================================================

/**
 * Émet un avoir annulant intégralement une facture d'origine.
 */
export async function createCreditNote(
  societyId: string,
  input: CreateCreditNoteInput
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    await requireSocietyAccess(session.user.id, societyId, "COMPTABLE");

    const parsed = createCreditNoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors.map((e) => e.message).join(", "),
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
      const invoiceNumber = await getNextInvoiceNumber(societyId, tx);
      return tx.invoice.create({
        data: {
          societyId,
          tenantId: original.tenantId,
          leaseId: original.leaseId,
          creditNoteForId: original.id,
          invoiceNumber,
          invoiceType: "AVOIR",
          status: "EN_ATTENTE",
          issueDate: new Date(parsed.data.issueDate),
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
      userId: session.user.id,
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

    return { success: true, data: { id: creditNote.id, invoiceNumber: creditNote.invoiceNumber } };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { success: false, error: error.message };
    console.error("[createCreditNote]", error);
    return { success: false, error: "Erreur lors de l'émission de l'avoir" };
  }
}
