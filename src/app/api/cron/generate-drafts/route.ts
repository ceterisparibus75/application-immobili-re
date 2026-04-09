import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  try {
    const results = await generateDraftInvoices();
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("[cron/generate-drafts]", error);
    return NextResponse.json(
      { error: "Erreur lors de la generation des brouillons" },
      { status: 500 }
    );
  }
}

/**
 * Genere automatiquement les brouillons de facture pour les echeances
 * a venir dans les 10 prochains jours.
 *
 * Pour chaque bail actif :
 * - Calcule la prochaine date d echeance
 * - Si elle est dans <= 10 jours et pas de facture existante, cree un brouillon
 */
async function generateDraftInvoices() {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 10);

  // Recuperer tous les baux actifs avec leurs provisions de charges
  const activeLeases = await prisma.lease.findMany({
    where: { status: "EN_COURS", isThirdPartyManaged: false },
    select: {
      id: true,
      societyId: true,
      tenantId: true,
      startDate: true,
      endDate: true,
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

  for (const lease of activeLeases) {
    try {
      // Determiner la prochaine echeance de facturation
      const nextDue = computeNextDueDate(lease.startDate, lease.paymentFrequency, now);
      if (!nextDue || nextDue > horizon) {
        skipped++;
        continue;
      }

      // Calculer la periode correspondante
      const periodMonth = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}`;
      const { periodStart, periodEnd } = computePeriod(periodMonth, lease.paymentFrequency);

      // Verifier si une facture existe deja pour cette periode
      const existing = await prisma.invoice.findFirst({
        where: {
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

      // Calculer le loyer
      const rentHT = computeRent(lease.startDate, lease.currentRentHT, lease.progressiveRent, lease.rentFreeMonths ?? 0);
      const vatRate = lease.vatApplicable ? (lease.vatRate ?? 20) : 0;

      const lotLabel = lease.lot
        ? `${lease.lot.building.name} - Lot ${lease.lot.number}`
        : "Lot";

      const periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

      const freqMultiplier: Record<string, number> = {
        MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12,
      };
      const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

      const rentVAT = rentHT * (vatRate / 100);
      const invoiceLines = [
        {
          label: `Loyer ${lotLabel} - ${periodLabel}`,
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
        const cpVat = ht * (cp.vatRate / 100);
        invoiceLines.push({
          label: `${cp.label} - ${periodLabel}`,
          quantity: 1,
          unitPrice: ht,
          vatRate: cp.vatRate,
          totalHT: ht,
          totalVAT: cpVat,
          totalTTC: ht + cpVat,
        });
      }

      const totalHT = invoiceLines.reduce((s, l) => s + l.totalHT, 0);
      const totalVAT = invoiceLines.reduce((s, l) => s + l.totalVAT, 0);
      const totalTTC = totalHT + totalVAT;

      const dueDate = lease.billingTerm === "A_ECHOIR" ? periodStart : new Date(periodEnd.getTime() + 86400000);

      await prisma.$transaction(async (tx) => {
        const invoiceNumber = await getNextInvoiceNumber(lease.societyId, tx);
        return tx.invoice.create({
          data: {
            societyId: lease.societyId,
            tenantId: lease.tenantId,
            leaseId: lease.id,
            invoiceNumber,
            invoiceType: "APPEL_LOYER",
            status: "BROUILLON",
            issueDate: new Date(),
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
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Bail ${lease.id}: ${msg}`);
    }
  }

  console.error("[cron/generate-drafts]", `${created} brouillon(s), ${skipped} ignore(s), ${errors.length} erreur(s)`);
  return { created, skipped, errors };
}

// Helpers - repliques des fonctions dans invoice.ts, sans dependance auth

function computeNextDueDate(
  startDate: Date,
  frequency: string,
  referenceDate: Date
): Date | null {
  const start = new Date(startDate);
  start.setDate(1);

  const monthStep: Record<string, number> = {
    MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12,
  };
  const step = monthStep[frequency] ?? 1;

  // Avancer depuis le debut du bail par pas de frequence
  const candidate = new Date(start);
  while (candidate <= referenceDate) {
    candidate.setMonth(candidate.getMonth() + step);
  }

  return candidate;
}

function computePeriod(
  periodMonth: string,
  frequency: string
): { periodStart: Date; periodEnd: Date } {
  const [y, m] = periodMonth.split("-").map(Number);
  switch (frequency) {
    case "TRIMESTRIEL": {
      const q = Math.floor((m - 1) / 3);
      return { periodStart: new Date(y, q * 3, 1), periodEnd: new Date(y, q * 3 + 3, 0) };
    }
    case "SEMESTRIEL": {
      const s = Math.floor((m - 1) / 6);
      return { periodStart: new Date(y, s * 6, 1), periodEnd: new Date(y, s * 6 + 6, 0) };
    }
    case "ANNUEL":
      return { periodStart: new Date(y, 0, 1), periodEnd: new Date(y, 12, 0) };
    default:
      return { periodStart: new Date(y, m - 1, 1), periodEnd: new Date(y, m, 0) };
  }
}

function computeRent(
  startDate: Date,
  currentRentHT: number,
  progressiveRent: unknown,
  rentFreeMonths: number
): number {
  const start = new Date(startDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

  if (months < Math.floor(rentFreeMonths)) return 0;

  if (progressiveRent && typeof progressiveRent === "object" && Array.isArray((progressiveRent as { steps?: unknown[] }).steps)) {
    const steps = (progressiveRent as { steps: { fromMonth: number; rentHT: number }[] }).steps;
    const sorted = [...steps].sort((a, b) => b.fromMonth - a.fromMonth);
    for (const s of sorted) {
      if (months >= s.fromMonth) return s.rentHT;
    }
  }

  return currentRentHT;
}

async function getNextInvoiceNumber(
  societyId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const last = await tx.invoice.findFirst({
    where: { societyId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = last ? parseInt(last.invoiceNumber.replace(prefix, ""), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
