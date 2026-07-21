import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!verifyCronSecret(authHeader)) {
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
 * a venir dans les 15 prochains jours.
 *
 * Pour chaque bail actif :
 * - Calcule la prochaine date d echeance
 * - Si elle est dans <= 15 jours et pas de facture existante, cree un brouillon
 *
 * A la fin, envoie un email au(x) gestionnaire(s) de chaque societe pour
 * signaler la disponibilite des brouillons a valider.
 */
async function generateDraftInvoices() {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 15);

  // Recuperer tous les baux actifs avec leurs provisions de charges
  const activeLeases = await prisma.lease.findMany({
    where: { status: "EN_COURS", isThirdPartyManaged: false },
    select: {
      id: true,
      societyId: true,
      tenantId: true,
      startDate: true,
      entryDate: true,
      endDate: true,
      paymentFrequency: true,
      billingTerm: true,
      billingAnchorMonth: true,
      billingAnchorDay: true,
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

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  // Regroupement pour l'email récap par société
  const draftsBySociety = new Map<
    string,
    Array<{ invoiceNumber: string | null; tenantName: string; lotLabel: string; totalTTC: number; dueDate: Date }>
  >();

  for (const lease of activeLeases) {
    try {
      const billingAnchor =
        lease.billingAnchorMonth != null && lease.billingAnchorDay != null
          ? { month: lease.billingAnchorMonth, day: lease.billingAnchorDay }
          : null;

      // Determiner la prochaine echeance de facturation
      const nextDue = computeNextDueDate(lease.startDate, lease.paymentFrequency, now, billingAnchor);
      if (!nextDue || nextDue > horizon) {
        skipped++;
        continue;
      }

      // Calculer la periode correspondante
      const periodMonth = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}`;
      // eslint-disable-next-line prefer-const
      let { periodStart, periodEnd } = computePeriod(periodMonth, lease.paymentFrequency, billingAnchor, nextDue);

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
      const cronEffectiveStart = lease.entryDate ?? lease.startDate;
      let rentHT = computeRent(lease.startDate, lease.currentRentHT, lease.progressiveRent, lease.rentFreeMonths ?? 0, lease.rentSteps, lease.entryDate, periodStart);
      const vatRate = lease.vatApplicable ? (lease.vatRate ?? 20) : 0;

      const cronRfm = lease.rentFreeMonths ?? 0;
      const cronRfmFloor = Math.floor(cronRfm);
      const cronRfmFrac = cronRfm - cronRfmFloor;
      const cronEffectiveFirstPaidDate = new Date(cronEffectiveStart);
      cronEffectiveFirstPaidDate.setMonth(cronEffectiveFirstPaidDate.getMonth() + cronRfmFloor);

      let cronProrataLabel = "";
      const cronLeaseStartDay = cronEffectiveFirstPaidDate.getDate();
      const cronIsFirstPeriod =
        periodStart.getFullYear() === cronEffectiveFirstPaidDate.getFullYear() &&
        periodStart.getMonth() === cronEffectiveFirstPaidDate.getMonth();
      if (cronIsFirstPeriod && rentHT > 0 && cronLeaseStartDay > 1 && cronRfmFrac === 0) {
        const y = cronEffectiveFirstPaidDate.getFullYear();
        const m = cronEffectiveFirstPaidDate.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const daysRemaining = daysInMonth - cronLeaseStartDay + 1;
        rentHT = Math.round((rentHT * daysRemaining / daysInMonth) * 100) / 100;
        cronProrataLabel = " (prorata " + daysRemaining + "/" + daysInMonth + " j.)";
      }
      if (cronRfmFrac > 0 && rentHT > 0) {
        const cronLeaseStartNorm = new Date(cronEffectiveStart);
        cronLeaseStartNorm.setDate(1);
        const cronMonthsSince =
          (periodStart.getFullYear() - cronLeaseStartNorm.getFullYear()) * 12 +
          (periodStart.getMonth() - cronLeaseStartNorm.getMonth());
        if (cronMonthsSince === cronRfmFloor) {
          const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
          const freeDays = Math.round(cronRfmFrac * daysInMonth);
          const paidDays = daysInMonth - freeDays;
          rentHT = Math.round((rentHT * paidDays / daysInMonth) * 100) / 100;
          cronProrataLabel = cronProrataLabel + " (franchise " + freeDays + "/" + daysInMonth + " j.)";
        }
      }

      // Prorata annuel custom : si la période ANNUEL avec anchor démarre avant
      // l'entrée effective dans les lieux, la 1ère facture ne couvre que la
      // fraction réellement louée (ex: bail entré le 3 mars, anchor 1er juillet
      // → 1ère facture = 3 mars → 30 juin sur la période 1er juillet année
      // précédente → 30 juin année courante).
      if (
        lease.paymentFrequency === "ANNUEL" &&
        billingAnchor &&
        lease.currentRentHT > 0
      ) {
        // Fallback startDate si entryDate n'est pas saisie.
        const entry = new Date(lease.entryDate ?? lease.startDate);
        if (entry > periodStart && entry <= periodEnd) {
          const dayMs = 86400000;
          const daysTotal = Math.round((periodEnd.getTime() - periodStart.getTime()) / dayMs) + 1;
          const daysEffective = Math.round((periodEnd.getTime() - entry.getTime()) / dayMs) + 1;
          rentHT = Math.round((lease.currentRentHT * daysEffective / daysTotal) * 100) / 100;
          cronProrataLabel = cronProrataLabel + ` (prorata ${daysEffective}/${daysTotal} j.)`;
          // La facture porte la période réellement facturée (entry → anchor - 1j)
          // et non le cycle complet.
          periodStart = entry;
        }
      }

      const lotLabel = lease.lot
        ? `${lease.lot.building.name} - Lot ${lease.lot.number}`
        : "Lot";

      const periodLabel = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

      const freqMultiplier: Record<string, number> = {
        MENSUEL: 1, TRIMESTRIEL: 3, SEMESTRIEL: 6, ANNUEL: 12,
      };
      const mult = freqMultiplier[lease.paymentFrequency] ?? 1;

      // Prorata révision : si une révision intervient dans la période
      const revisionInPeriod = await prisma.rentRevision.findFirst({
        where: {
          leaseId: lease.id,
          isValidated: true,
          effectiveDate: { gt: periodStart, lte: periodEnd },
        },
        orderBy: { effectiveDate: "asc" },
        select: { effectiveDate: true, previousRentHT: true, newRentHT: true },
      });

      const invoiceLines: Array<{
        label: string; quantity: number; unitPrice: number;
        vatRate: number; totalHT: number; totalVAT: number; totalTTC: number;
      }> = [];

      if (revisionInPeriod) {
        const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
        const daysBefore = Math.round((revisionInPeriod.effectiveDate.getTime() - periodStart.getTime()) / 86400000);
        const daysAfter = totalDays - daysBefore;
        if (daysBefore > 0 && daysAfter > 0) {
          const oldRentHT = Math.round(revisionInPeriod.previousRentHT * daysBefore / totalDays * 100) / 100;
          const newRentHT = Math.round(revisionInPeriod.newRentHT * daysAfter / totalDays * 100) / 100;
          const oldVAT = Math.round(oldRentHT * vatRate / 100 * 100) / 100;
          const newVAT = Math.round(newRentHT * vatRate / 100 * 100) / 100;
          const effDateStr = revisionInPeriod.effectiveDate.toLocaleDateString("fr-FR");
          invoiceLines.push(
            {
              label: `Loyer ${lotLabel} - ${periodLabel} (avant révision, ${daysBefore}/${totalDays} j.)`,
              quantity: 1, unitPrice: oldRentHT, vatRate,
              totalHT: oldRentHT, totalVAT: oldVAT, totalTTC: oldRentHT + oldVAT,
            },
            {
              label: `Loyer ${lotLabel} - ${periodLabel} (révisé au ${effDateStr}, ${daysAfter}/${totalDays} j.)`,
              quantity: 1, unitPrice: newRentHT, vatRate,
              totalHT: newRentHT, totalVAT: newVAT, totalTTC: newRentHT + newVAT,
            },
          );
        }
      }

      if (invoiceLines.length === 0) {
        const rentVAT = rentHT * (vatRate / 100);
        invoiceLines.push({
          label: `Loyer ${lotLabel} - ${periodLabel}${cronProrataLabel}`,
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

      const draft = await prisma.invoice.create({
        data: {
          societyId: lease.societyId,
          tenantId: lease.tenantId,
          leaseId: lease.id,
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

      const tenantName =
        lease.tenant.entityType === "PERSONNE_MORALE"
          ? lease.tenant.companyName ?? "—"
          : `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";
      const list = draftsBySociety.get(lease.societyId) ?? [];
      list.push({
        invoiceNumber: draft.invoiceNumber,
        tenantName,
        lotLabel: lotLabel,
        totalTTC,
        dueDate,
      });
      draftsBySociety.set(lease.societyId, list);

      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Bail ${lease.id}: ${msg}`);
    }
  }

  // Notifier les gestionnaires de chaque société ayant reçu des brouillons.
  // Les échecs d'envoi ne bloquent pas le cron : on log seulement.
  let notified = 0;
  const notifyErrors: string[] = [];
  for (const [societyId, drafts] of draftsBySociety) {
    try {
      await notifyManagersOfDrafts(societyId, drafts);
      notified++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notifyErrors.push(`Société ${societyId}: ${msg}`);
    }
  }

  if (errors.length > 0 || notifyErrors.length > 0) {
    console.error(
      "[cron/generate-drafts]",
      `${created} brouillon(s), ${skipped} ignore(s), ${errors.length} erreur(s), ${notified} notif(s), ${notifyErrors.length} echec(s) notif`,
      { errors, notifyErrors }
    );
  }
  return { created, skipped, notified, errors: [...errors, ...notifyErrors] };
}

async function notifyManagersOfDrafts(
  societyId: string,
  drafts: Array<{ invoiceNumber: string | null; tenantName: string; lotLabel: string; totalTTC: number; dueDate: Date }>
) {
  const [society, userSocieties] = await Promise.all([
    prisma.society.findUnique({ where: { id: societyId }, select: { name: true } }),
    prisma.userSociety.findMany({
      where: { societyId, role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] } },
      select: { user: { select: { email: true, firstName: true, lastName: true } } },
    }),
  ]);
  if (!society) return;
  const recipients = userSocieties
    .map((us) => us.user)
    .filter((u): u is { email: string; firstName: string | null; lastName: string | null } =>
      Boolean(u?.email)
    );
  if (recipients.length === 0) return;

  const { sendDraftsReadyEmail } = await import("@/lib/email");
  for (const user of recipients) {
    const recipientName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null;
    await sendDraftsReadyEmail({
      to: user.email,
      recipientName,
      societyName: society.name,
      drafts,
    });
  }
}

// Helpers - repliques des fonctions dans invoice.ts, sans dependance auth

function computeNextDueDate(
  startDate: Date,
  frequency: string,
  referenceDate: Date,
  billingAnchor?: { month: number; day: number } | null
): Date | null {
  // Les fréquences trimestrielle / semestrielle / annuelle sont alignées sur
  // le calendrier civil par computePeriod (Q1 = jan-mar, etc.). Si on partait
  // du startDate du bail, un bail démarré au milieu d'un trimestre (ex. 1er
  // février) atterrirait sur des bornes décalées (02, 05, 08, 11) et le cron
  // skiperait des périodes civiles entières. On aligne donc explicitement.
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();

  let candidate: Date;
  switch (frequency) {
    case "TRIMESTRIEL": {
      const nextQuarterStartMonth = Math.floor(refMonth / 3) * 3 + 3;
      candidate = new Date(refYear + Math.floor(nextQuarterStartMonth / 12), nextQuarterStartMonth % 12, 1);
      break;
    }
    case "SEMESTRIEL": {
      const nextSemesterStartMonth = Math.floor(refMonth / 6) * 6 + 6;
      candidate = new Date(refYear + Math.floor(nextSemesterStartMonth / 12), nextSemesterStartMonth % 12, 1);
      break;
    }
    case "ANNUEL": {
      // Anchor personnalisé (ex: bail à terme échu au 1er juillet). Le cycle
      // court de (anchor+1j) à anchor de l'année suivante. La prochaine
      // "due date" = prochain jour anchor après referenceDate.
      if (billingAnchor) {
        const anchorMonth = billingAnchor.month - 1;
        const anchorDay = billingAnchor.day;
        // Tentative dans l'année courante
        const thisYearAnchor = new Date(refYear, anchorMonth, anchorDay);
        if (thisYearAnchor > referenceDate) {
          candidate = thisYearAnchor;
        } else {
          candidate = new Date(refYear + 1, anchorMonth, anchorDay);
        }
      } else {
        candidate = new Date(refYear + 1, 0, 1);
      }
      break;
    }
    case "MENSUEL":
    default: {
      const nextMonth = refMonth + 1;
      candidate = new Date(refYear + Math.floor(nextMonth / 12), nextMonth % 12, 1);
      break;
    }
  }

  // Ne jamais retourner une date antérieure au début du bail
  const startFloor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  if (candidate < startFloor) {
    return startFloor;
  }
  return candidate;
}

function computePeriod(
  periodMonth: string,
  frequency: string,
  billingAnchor?: { month: number; day: number } | null,
  dueDate?: Date
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
    case "ANNUEL": {
      // Période annuelle alignée sur un anchor contractuel (ex: terme échu
      // au 1er juillet) : la facture émise au jour anchor solde la période
      // qui s'achève la veille. Cycle : [anchor N-1, anchor N - 1 jour].
      if (billingAnchor && dueDate) {
        const periodEnd = new Date(dueDate);
        periodEnd.setDate(periodEnd.getDate() - 1);
        const periodStart = new Date(periodEnd);
        periodStart.setFullYear(periodStart.getFullYear() - 1);
        periodStart.setDate(periodStart.getDate() + 1);
        return { periodStart, periodEnd };
      }
      return { periodStart: new Date(y, 0, 1), periodEnd: new Date(y, 12, 0) };
    }
    default:
      return { periodStart: new Date(y, m - 1, 1), periodEnd: new Date(y, m, 0) };
  }
}

function computeRent(
  startDate: Date,
  currentRentHT: number,
  progressiveRent: unknown,
  rentFreeMonths: number,
  rentSteps?: { startDate: Date; endDate: Date | null; rentHT: number }[],
  entryDate?: Date | null,
  referenceDate: Date = new Date()
): number {
  const effectiveStart = entryDate ?? startDate;
  const start = new Date(effectiveStart);
  const now = new Date(referenceDate);
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

  if (months < Math.floor(rentFreeMonths)) return 0;

  // Priorité 1 : paliers de loyer (LeaseRentStep) basés sur les dates
  if (rentSteps && rentSteps.length > 0) {
    // Chercher le palier actif pour la date courante
    for (let i = rentSteps.length - 1; i >= 0; i--) {
      const step = rentSteps[i];
      const stepStart = new Date(step.startDate);
      const stepEnd = step.endDate ? new Date(step.endDate) : null;
      if (now >= stepStart && (!stepEnd || now <= stepEnd)) {
        return step.rentHT;
      }
    }
  }

  // Priorité 2 : ancien champ progressiveRent JSON (rétrocompatibilité)
  if (progressiveRent && typeof progressiveRent === "object" && Array.isArray((progressiveRent as { steps?: unknown[] }).steps)) {
    const steps = (progressiveRent as { steps: { fromMonth: number; rentHT: number }[] }).steps;
    const sorted = [...steps].sort((a, b) => b.fromMonth - a.fromMonth);
    for (const s of sorted) {
      if (months >= s.fromMonth) return s.rentHT;
    }
  }

  return currentRentHT;
}

