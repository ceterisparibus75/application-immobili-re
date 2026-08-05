"use server";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/permissions";
import type { ActionResult } from "@/actions/society";
import {
  requireSocietyActionContext,
  UnauthenticatedActionError,
} from "@/lib/action-society";

export type HealthSeverity = "critical" | "warning" | "info";
export type HealthCategory = "compta" | "juridique" | "banque" | "donnees" | "communication";

export interface HealthCheckItem {
  key: string;
  category: HealthCategory;
  title: string;
  description: string;
  severity: HealthSeverity;
  count: number;
  actionHref?: string;
  actionLabel?: string;
  /** Aperçu texte de quelques items (max 5) pour aider le user à identifier. */
  preview?: string[];
}

export interface HealthCheckReport {
  checks: HealthCheckItem[];
  computedAt: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalIssues: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Diagnostic transversal de la santé des données de la société.
 *
 * Chaque check est stateless — recalculé à la volée depuis la BDD, pas de
 * table dédiée. Les items sortent uniquement quand `count > 0` pour rester
 * lisibles. Rôle minimum : GESTIONNAIRE.
 */
export async function getHealthChecks(
  societyId: string
): Promise<ActionResult<HealthCheckReport>> {
  try {
    await requireSocietyActionContext(societyId, "GESTIONNAIRE");

    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);
    const oneDayAgo = new Date(now.getTime() - 1 * DAY_MS);

    const [
      leasesIndexIncomplete,
      draftsOld,
      overduePastEndDate,
      overdueInvoicesLong,
      failedProofs,
      tenantsWithoutEmail,
      societyProfileMissing,
      duplicateTxCandidates,
      unletteredLines,
    ] = await Promise.all([
      // 1. Baux avec indexation mais indice de base incomplet
      prisma.lease.findMany({
        where: {
          societyId,
          status: "EN_COURS",
          deletedAt: null,
          indexType: { not: null },
          NOT: { indexType: "POURCENTAGE_FIXE" },
          OR: [
            { baseIndexValue: null },
            { baseIndexQuarter: null },
          ],
        },
        select: {
          id: true,
          tenant: { select: { companyName: true, firstName: true, lastName: true } },
          lot: { select: { number: true, building: { select: { name: true } } } },
        },
        take: 20,
      }),

      // 2. Brouillons de facture > 60 jours
      prisma.invoice.findMany({
        where: {
          societyId,
          status: "BROUILLON",
          createdAt: { lt: sixtyDaysAgo },
        },
        select: {
          id: true,
          createdAt: true,
          tenant: { select: { companyName: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),

      // 3. Baux EN_COURS avec endDate passée
      prisma.lease.findMany({
        where: {
          societyId,
          status: "EN_COURS",
          deletedAt: null,
          endDate: { lt: now },
        },
        select: {
          id: true,
          endDate: true,
          tenant: { select: { companyName: true, firstName: true, lastName: true } },
          lot: { select: { number: true, building: { select: { name: true } } } },
        },
        take: 20,
      }),

      // 4. Factures envoyées mais impayées depuis > 90 jours
      prisma.invoice.findMany({
        where: {
          societyId,
          sentAt: { not: null, lt: ninetyDaysAgo },
          invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
          status: { in: ["EN_RETARD", "RELANCEE", "PARTIELLEMENT_PAYE", "LITIGIEUX"] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          totalTTC: true,
          dueDate: true,
          tenant: { select: { companyName: true, firstName: true, lastName: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),

      // 5. Preuves d'envoi en échec ou bounced non traitées depuis > 24h
      prisma.emailDeliveryProof.findMany({
        where: {
          societyId,
          status: { in: ["FAILED", "BOUNCED"] },
          sentAt: { lt: oneDayAgo },
        },
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          status: true,
        },
        orderBy: { sentAt: "desc" },
        take: 20,
      }),

      // 6. Locataires actifs sans email (email est requis mais peut être vide)
      prisma.tenant.findMany({
        where: {
          societyId,
          isActive: true,
          deletedAt: null,
          email: "",
          leases: { some: { status: "EN_COURS", deletedAt: null } },
        },
        select: {
          id: true,
          companyName: true,
          firstName: true,
          lastName: true,
        },
        take: 20,
      }),

      // 7. Profil société incomplet (SIRET + email obligatoires EN 16931)
      prisma.society.findUnique({
        where: { id: societyId },
        select: { siret: true, email: true, name: true },
      }),

      // 8. Doublons potentiels de transactions bancaires
      // Détection SQL : même compte + date + montant + label sur au moins 2 lignes.
      prisma.$queryRaw<Array<{ label: string; amount: number; transactionDate: Date; count: bigint }>>`
        SELECT t."label", t."amount", t."transactionDate", COUNT(*)::bigint AS count
        FROM "BankTransaction" t
        JOIN "BankAccount" a ON a."id" = t."bankAccountId"
        WHERE a."societyId" = ${societyId}
        GROUP BY t."label", t."amount", t."transactionDate", t."bankAccountId"
        HAVING COUNT(*) > 1
        LIMIT 20
      `,

      // 9. Écritures 411 non lettrées > 90 jours
      // Compte les journalEntryLine sur des comptes commençant par "411" créées il y a > 90j
      // sans letteringCode ni lettrage.
      prisma.journalEntryLine.findMany({
        where: {
          journalEntry: {
            societyId,
            entryDate: { lt: ninetyDaysAgo },
          },
          account: { code: { startsWith: "411" } },
          letteringCode: null,
          lettrage: null,
        },
        select: {
          id: true,
          debit: true,
          credit: true,
          journalEntry: {
            select: {
              id: true,
              entryDate: true,
              label: true,
            },
          },
        },
        orderBy: { journalEntry: { entryDate: "asc" } },
        take: 20,
      }),
    ]);

    const tenantLabel = (t: { companyName?: string | null; firstName?: string | null; lastName?: string | null }) => {
      return t.companyName || `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
    };

    const checks: HealthCheckItem[] = [];

    // 1
    if (leasesIndexIncomplete.length > 0) {
      checks.push({
        key: "leases-index-incomplete",
        category: "juridique",
        severity: "warning",
        title: `${leasesIndexIncomplete.length} bail(s) avec indexation incomplète`,
        description:
          "L'indice INSEE est configuré (IRL/ILC/ILAT/ICC) mais il manque la valeur de référence ou le trimestre. Les révisions automatiques ne peuvent pas s'exécuter.",
        count: leasesIndexIncomplete.length,
        actionHref: "/baux",
        actionLabel: "Voir les baux",
        preview: leasesIndexIncomplete.slice(0, 5).map(
          (l) => `${tenantLabel(l.tenant)} — ${l.lot?.building?.name ?? "?"} Lot ${l.lot?.number ?? "?"}`
        ),
      });
    }

    // 2
    if (draftsOld.length > 0) {
      checks.push({
        key: "drafts-old",
        category: "compta",
        severity: "warning",
        title: `${draftsOld.length} brouillon(s) de facture > 60 jours`,
        description: "Ces brouillons n'ont jamais été validés. Supprimez-les ou validez-les pour clarifier votre file d'envoi.",
        count: draftsOld.length,
        actionHref: "/facturation?tab=brouillons",
        actionLabel: "Traiter les brouillons",
        preview: draftsOld.slice(0, 5).map(
          (d) => `${tenantLabel(d.tenant)} — créé le ${d.createdAt.toLocaleDateString("fr-FR")}`
        ),
      });
    }

    // 3
    if (overduePastEndDate.length > 0) {
      checks.push({
        key: "leases-past-end-date",
        category: "juridique",
        severity: "critical",
        title: `${overduePastEndDate.length} bail(s) EN_COURS avec date de fin passée`,
        description:
          "Le bail est marqué actif mais sa date de fin théorique est dépassée. Confirmez le renouvellement tacite ou résiliez explicitement.",
        count: overduePastEndDate.length,
        actionHref: "/baux",
        actionLabel: "Vérifier les baux",
        preview: overduePastEndDate.slice(0, 5).map(
          (l) => `${tenantLabel(l.tenant)} — fin ${l.endDate.toLocaleDateString("fr-FR")}`
        ),
      });
    }

    // 4
    if (overdueInvoicesLong.length > 0) {
      checks.push({
        key: "invoices-overdue-long",
        category: "compta",
        severity: "critical",
        title: `${overdueInvoicesLong.length} facture(s) impayée(s) depuis > 90 jours`,
        description:
          "Ces factures sont émises depuis plus de 90 jours et non soldées. Envisagez la mise en demeure ou le passage en LITIGIEUX / IRRECOUVRABLE.",
        count: overdueInvoicesLong.length,
        actionHref: "/facturation?tab=relances",
        actionLabel: "Ouvrir les relances",
        preview: overdueInvoicesLong.slice(0, 5).map(
          (i) => `${i.invoiceNumber ?? i.id} — ${tenantLabel(i.tenant)} — ${i.totalTTC.toFixed(2)} €`
        ),
      });
    }

    // 5
    if (failedProofs.length > 0) {
      checks.push({
        key: "email-proofs-failed",
        category: "communication",
        severity: "critical",
        title: `${failedProofs.length} envoi(s) email en échec non traité`,
        description:
          "Ces emails ont bounced ou échoué à la livraison. Vérifiez l'adresse du destinataire et re-envoyez manuellement.",
        count: failedProofs.length,
        actionHref: "/documents/preuves-envoi?status=BOUNCED",
        actionLabel: "Voir les preuves en échec",
        preview: failedProofs.slice(0, 5).map(
          (p) => `${p.recipientEmail} — ${p.status} — « ${p.subject.slice(0, 40)} »`
        ),
      });
    }

    // 6
    if (tenantsWithoutEmail.length > 0) {
      checks.push({
        key: "tenants-without-email",
        category: "communication",
        severity: "warning",
        title: `${tenantsWithoutEmail.length} locataire(s) actif(s) sans email`,
        description:
          "Impossible d'envoyer factures, quittances ou relances. Complétez la fiche locataire.",
        count: tenantsWithoutEmail.length,
        actionHref: "/locataires",
        actionLabel: "Voir les locataires",
        preview: tenantsWithoutEmail.slice(0, 5).map(tenantLabel),
      });
    }

    // 7
    if (!societyProfileMissing?.siret || !societyProfileMissing?.email) {
      const missing: string[] = [];
      if (!societyProfileMissing?.siret) missing.push("SIRET");
      if (!societyProfileMissing?.email) missing.push("email de contact");
      checks.push({
        key: "society-profile-incomplete",
        category: "donnees",
        severity: "warning",
        title: "Profil société incomplet",
        description: `Champs manquants : ${missing.join(", ")}. Obligatoires pour émettre des factures électroniques (EN 16931 BT-30 + BT-34).`,
        count: 1,
        actionHref: `/societes/${societyId}/modifier`,
        actionLabel: "Compléter le profil",
      });
    }

    // 8
    const duplicateGroups = duplicateTxCandidates
      .map((row) => ({
        label: row.label,
        amount: row.amount,
        date: row.transactionDate,
        count: Number(row.count),
      }))
      .filter((g) => g.count > 1);
    if (duplicateGroups.length > 0) {
      const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0);
      checks.push({
        key: "bank-tx-duplicates",
        category: "banque",
        severity: "warning",
        title: `${totalDuplicates} transaction(s) bancaire(s) en doublon potentiel`,
        description:
          "Détection basée sur date + montant + libellé identiques dans un même compte. Vérifiez si un import a été répété.",
        count: totalDuplicates,
        actionHref: "/banque",
        actionLabel: "Auditer les comptes",
        preview: duplicateGroups.slice(0, 5).map(
          (g) => `${g.date.toLocaleDateString("fr-FR")} — ${g.amount.toFixed(2)} € — « ${g.label.slice(0, 35)} » (×${g.count})`
        ),
      });
    }

    // 9
    if (unletteredLines.length > 0) {
      const totalUnbalanced = unletteredLines.reduce(
        (sum, l) => sum + Math.abs(l.debit - l.credit),
        0
      );
      checks.push({
        key: "accounting-unlettered",
        category: "compta",
        severity: "info",
        title: `${unletteredLines.length} écriture(s) 411 non lettrée(s) > 90 jours`,
        description: `Le compte client 411 doit être lettré régulièrement. Écart cumulé : ${totalUnbalanced.toFixed(2)} €.`,
        count: unletteredLines.length,
        actionHref: "/comptabilite/lettrage",
        actionLabel: "Lettrer",
      });
    }

    const criticalCount = checks.filter((c) => c.severity === "critical").length;
    const warningCount = checks.filter((c) => c.severity === "warning").length;
    const infoCount = checks.filter((c) => c.severity === "info").length;

    return {
      success: true,
      data: {
        checks,
        computedAt: now.toISOString(),
        criticalCount,
        warningCount,
        infoCount,
        totalIssues: checks.length,
      },
    };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) return { success: false, error: error.message };
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    console.error("[getHealthChecks]", error);
    return { success: false, error: "Erreur lors du diagnostic" };
  }
}
