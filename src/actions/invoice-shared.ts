// Helpers privés et types partagés — pas de "use server" (importé par les sous-modules)

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { createClient } from "@supabase/supabase-js";
import type { PaymentFrequency, BillingTerm, Prisma } from "@/generated/prisma/client";

// ============================================================
// TYPES EXPORTÉS
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
  bankName: string | null;
  signatoryName: string | null;
  phone: string | null;
  legalForm: string | null;
  shareCapital: number | null;
  email: string | null;
};

export type InvoicePreview = {
  leaseId: string;
  invoiceType: string;
  tenantName: string;
  tenantAddress: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  lotLabel: string;
  lotNumber: string;
  periodLabel: string;
  periodStartISO: string;
  periodEndISO: string;
  issueDate: string;
  dueDate: string;
  lines: InvoicePreviewLine[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  alreadyExists: boolean;
  society: InvoicePreviewSociety | null;
  iban: string | null;
  bic: string | null;
  logoResolvedUrl: string | null;
  previousBalance: number;
};

// ============================================================
// HELPERS PURS
// ============================================================

export function computeLines(
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
export async function getNextInvoiceNumber(
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

  const prefix = (current?.invoicePrefix?.toUpperCase() || "FAC");
  return `${prefix}-${currentYear}-${String(society.nextInvoiceNumber).padStart(4, "0")}`;
}

/** Calcule les dates de début/fin d'une période à partir d'un mois (ex: "2025-01"). */
export function computePeriodDates(
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
export function computeIssueDueDate(
  periodStart: Date,
  periodEnd: Date,
  billingTerm: BillingTerm
): { issueDate: Date; dueDate: Date } {
  const issueDate = new Date();
  if (billingTerm === "A_ECHOIR") {
    return { issueDate, dueDate: periodStart };
  }
  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() + 1);
  return { issueDate, dueDate };
}

/** Calcule le loyer applicable pour une période donnée. */
export function computeRentForPeriod(
  startDate: Date,
  currentRentHT: number,
  progressiveRent: unknown,
  rentFreeMonths: number,
  rentSteps?: { startDate: Date; endDate: Date | null; rentHT: number }[]
): number {
  const start = new Date(startDate);
  start.setDate(1);
  const now = new Date();
  now.setDate(1);
  const monthsSinceStart =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  if (monthsSinceStart < Math.floor(rentFreeMonths)) return 0;

  if (rentSteps && rentSteps.length > 0) {
    for (let i = rentSteps.length - 1; i >= 0; i--) {
      const step = rentSteps[i];
      const stepStart = new Date(step.startDate);
      const stepEnd = step.endDate ? new Date(step.endDate) : null;
      if (now >= stepStart && (!stepEnd || now <= stepEnd)) {
        return step.rentHT;
      }
    }
  }

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

/** Calcule les honoraires de gestion tiers */
export function computeManagementFee(
  lease: {
    managementFeeType: string | null;
    managementFeeValue: number | null;
    managementFeeBasis: string | null;
    managementFeeVatRate: number | null;
  },
  rentHT: number,
  chargesHT: number,
  totalTTC: number
): { feeHT: number; feeVAT: number; feeTTC: number } {
  if (!lease.managementFeeType || !lease.managementFeeValue) {
    return { feeHT: 0, feeVAT: 0, feeTTC: 0 };
  }

  let feeHT: number;
  if (lease.managementFeeType === "FORFAIT") {
    feeHT = lease.managementFeeValue;
  } else {
    const base =
      lease.managementFeeBasis === "LOYER_HT"
        ? rentHT
        : lease.managementFeeBasis === "LOYER_CHARGES_HT"
          ? rentHT + chargesHT
          : totalTTC;
    feeHT = Math.round(base * (lease.managementFeeValue / 100) * 100) / 100;
  }

  const vatRate = lease.managementFeeVatRate ?? 20;
  const feeVAT = Math.round(feeHT * (vatRate / 100) * 100) / 100;
  return { feeHT, feeVAT, feeTTC: Math.round((feeHT + feeVAT) * 100) / 100 };
}

/**
 * Si une révision de loyer validée prend effet dans la période de facturation,
 * retourne deux lignes proratisées (ancien + nouveau loyer) au lieu d'une seule.
 */
export async function buildRevisionProrataLines(
  leaseId: string,
  periodStart: Date,
  periodEnd: Date,
  vatRate: number,
  lotLabel: string,
  periodLabel: string,
): Promise<{
  rentHT: number;
  lines: Array<{
    label: string; quantity: number; unitPrice: number;
    vatRate: number; totalHT: number; totalVAT: number; totalTTC: number;
  }>;
} | null> {
  const revision = await prisma.rentRevision.findFirst({
    where: {
      leaseId,
      isValidated: true,
      effectiveDate: { gt: periodStart, lte: periodEnd },
    },
    orderBy: { effectiveDate: "asc" },
    select: { effectiveDate: true, previousRentHT: true, newRentHT: true },
  });

  if (!revision) return null;

  const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
  const daysBefore = Math.round((revision.effectiveDate.getTime() - periodStart.getTime()) / 86400000);
  const daysAfter = totalDays - daysBefore;

  if (daysBefore <= 0 || daysAfter <= 0) return null;

  const oldRentHT = Math.round(revision.previousRentHT * daysBefore / totalDays * 100) / 100;
  const newRentHT = Math.round(revision.newRentHT * daysAfter / totalDays * 100) / 100;
  const oldVAT = Math.round(oldRentHT * vatRate / 100 * 100) / 100;
  const newVAT = Math.round(newRentHT * vatRate / 100 * 100) / 100;
  const effDateStr = revision.effectiveDate.toLocaleDateString("fr-FR");

  return {
    rentHT: oldRentHT + newRentHT,
    lines: [
      {
        label: `Loyer ${lotLabel} — ${periodLabel} (avant révision, ${daysBefore}/${totalDays} j.)`,
        quantity: 1, unitPrice: oldRentHT, vatRate,
        totalHT: oldRentHT, totalVAT: oldVAT, totalTTC: oldRentHT + oldVAT,
      },
      {
        label: `Loyer ${lotLabel} — ${periodLabel} (révisé au ${effDateStr}, ${daysAfter}/${totalDays} j.)`,
        quantity: 1, unitPrice: newRentHT, vatRate,
        totalHT: newRentHT, totalVAT: newVAT, totalTTC: newRentHT + newVAT,
      },
    ],
  };
}

/** Calcule les lignes d'une facture sans la créer. */
export async function computeInvoicePreview(
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
      rentSteps: {
        orderBy: { position: "asc" as const },
        select: { startDate: true, endDate: true, rentHT: true },
      },
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
        select: {
          number: true,
          building: { select: { name: true, addressLine1: true, postalCode: true, city: true, country: true } },
        },
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
      bankName: true,
      signatoryName: true,
      ibanEncrypted: true,
      bicEncrypted: true,
      phone: true,
      legalForm: true,
      shareCapital: true,
      email: true,
    },
  });

  let iban: string | null = null;
  let bic: string | null = null;
  try {
    if (society?.ibanEncrypted) iban = decrypt(society.ibanEncrypted);
    if (society?.bicEncrypted)  bic  = decrypt(society.bicEncrypted);
  } catch { /* non bloquant */ }

  let logoResolvedUrl: string | null = null;
  if (society?.logoUrl) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const logoUrl = society.logoUrl;
      let storagePath: string | null = null;

      if (!logoUrl.startsWith("http")) {
        storagePath = logoUrl.replace(/^\//, "");
      } else {
        const m = logoUrl.match(
          /\/storage\/v1\/object\/(?:sign\/|upload\/sign\/|public\/)[^/]+\/(.+?)(?:\?|$)/
        );
        if (m) storagePath = decodeURIComponent(m[1]);
      }

      if (storagePath) {
        const clean = storagePath.replace(/\.\.\//g, "").replace(/^\//, "");
        const { data } = await supabase.storage
          .from(process.env.SUPABASE_STORAGE_BUCKET ?? "documents")
          .createSignedUrl(clean, 3600);
        if (data?.signedUrl) logoResolvedUrl = data.signedUrl;
      }
    } catch { /* non bloquant */ }
  }

  let previousBalance = 0;
  if (lease.id) {
    const unpaid = await prisma.invoice.findMany({
      where: {
        societyId,
        leaseId: lease.id,
        status: { in: ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"] },
      },
      select: { totalTTC: true, payments: { select: { amount: true } } },
    });
    previousBalance = unpaid.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      return sum + (inv.totalTTC - paid);
    }, 0);
  }

  const { periodStart, periodEnd } = computePeriodDates(periodMonth, lease.paymentFrequency);
  const { issueDate, dueDate } = computeIssueDueDate(periodStart, periodEnd, lease.billingTerm);
  let rentHT = computeRentForPeriod(
    lease.startDate,
    lease.currentRentHT,
    lease.progressiveRent,
    lease.rentFreeMonths ?? 0,
    lease.rentSteps
  );

  let prorataLabel = "";
  const leaseStartDay = new Date(lease.startDate).getDate();
  const isFirstPeriod =
    periodStart.getFullYear() === new Date(lease.startDate).getFullYear() &&
    periodStart.getMonth() === new Date(lease.startDate).getMonth();
  if (isFirstPeriod && rentHT > 0 && leaseStartDay > 1) {
    const y = new Date(lease.startDate).getFullYear();
    const m = new Date(lease.startDate).getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysRemaining = daysInMonth - leaseStartDay + 1;
    rentHT = Math.round((rentHT * daysRemaining / daysInMonth) * 100) / 100;
    prorataLabel = ` (prorata ${daysRemaining}/${daysInMonth} j.)`;
  }

  const rfm = lease.rentFreeMonths ?? 0;
  const rfmFrac = rfm - Math.floor(rfm);
  if (rfmFrac > 0 && rentHT > 0) {
    const leaseStartNorm = new Date(lease.startDate);
    leaseStartNorm.setDate(1);
    const monthsSinceLease =
      (periodStart.getFullYear() - leaseStartNorm.getFullYear()) * 12 +
      (periodStart.getMonth() - leaseStartNorm.getMonth());
    if (monthsSinceLease === Math.floor(rfm)) {
      const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
      const freeDays = Math.round(rfmFrac * daysInMonth);
      const paidDays = daysInMonth - freeDays;
      rentHT = Math.round((rentHT * paidDays / daysInMonth) * 100) / 100;
      prorataLabel = prorataLabel + " (franchise " + freeDays + "/" + daysInMonth + " j.)";
    }
  }
  const vatRate = lease.vatApplicable ? lease.vatRate : 0;
  const freqMultiplier: Record<string, number> = { MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12 };
  const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

  const lotLabel = lease.lot
    ? `${lease.lot.number} — ${[lease.lot.building.addressLine1, lease.lot.building.postalCode, lease.lot.building.city].filter(Boolean).join(" ")}`
    : "Lot non précisé";
  const lotNumber = lease.lot?.number ?? "";
  const periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const tenantName =
    lease.tenant.entityType === "PERSONNE_MORALE"
      ? (lease.tenant.companyName ?? "—")
      : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";

  const revisionProrata = await buildRevisionProrataLines(
    lease.id, periodStart, periodEnd, vatRate, lotLabel, periodLabel,
  );

  const lines: InvoicePreviewLine[] = [];
  if (revisionProrata) {
    lines.push(...revisionProrata.lines);
  } else {
    const rentVAT = rentHT * (vatRate / 100);
    lines.push({
      label: `Loyer${prorataLabel}`,
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
    lines.push({
      label: cp.label,
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

  const societyClean = society ? {
    name: society.name,
    logoUrl: society.logoUrl,
    siret: society.siret,
    vatNumber: society.vatNumber,
    vatRegime: society.vatRegime,
    addressLine1: society.addressLine1,
    addressLine2: society.addressLine2,
    postalCode: society.postalCode,
    city: society.city,
    legalMentions: society.legalMentions,
    bankName: society.bankName,
    signatoryName: society.signatoryName,
    phone: society.phone,
    legalForm: society.legalForm,
    shareCapital: society.shareCapital,
    email: society.email,
  } : null;

  return {
    leaseId: lease.id,
    invoiceType: "APPEL_LOYER",
    tenantName,
    tenantAddress,
    tenantEmail: lease.tenant.billingEmail || lease.tenant.email || null,
    tenantPhone: lease.tenant.phone ?? null,
    lotLabel,
    lotNumber,
    periodLabel,
    periodStartISO: periodStart.toISOString(),
    periodEndISO: periodEnd.toISOString(),
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    lines,
    totalHT,
    totalVAT,
    totalTTC: totalHT + totalVAT,
    alreadyExists: !!existing,
    society: societyClean,
    iban,
    bic,
    logoResolvedUrl,
    previousBalance,
  };
}
