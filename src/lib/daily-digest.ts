import { prisma } from "@/lib/prisma";

/**
 * Construit le digest quotidien d'un utilisateur : agrège les items
 * "à traiter" ce jour sur toutes ses sociétés (ADMIN_SOCIETE + GESTIONNAIRE).
 *
 * Design : lecture pure, aucune mutation. Le cron appelle ce builder puis
 * envoie l'email ; le flag `dailyDigestLastSentAt` est posé après envoi
 * réussi.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DigestSocietyBlock {
  societyId: string;
  societyName: string;
  drafts: number; // Brouillons de facture à valider
  overdueInvoices: {
    count: number;
    totalRemaining: number;
  };
  pendingRevisions: number; // Révisions de loyer en attente de validation
  leasesEndingSoon: number; // Baux dont l'endDate est dans les 30 prochains jours
  documentsExpiringSoon: number; // Documents avec dateExpiration ≤ 30j
  emailDeliveryIssues: number; // Preuves d'envoi FAILED/BOUNCED récentes
}

export interface DailyDigest {
  userId: string;
  userEmail: string;
  userName: string | null;
  societies: DigestSocietyBlock[];
  // Compteurs globaux pré-calculés pour éviter la duplication côté template
  totals: {
    drafts: number;
    overdueInvoices: number;
    overdueRemaining: number;
    pendingRevisions: number;
    leasesEndingSoon: number;
    documentsExpiringSoon: number;
    emailDeliveryIssues: number;
    grandTotal: number; // Somme des 6 catégories
  };
}

/**
 * Récupère les sociétés sur lesquelles un utilisateur peut agir (rôles
 * gestionnaires uniquement, filtre sociétés actives).
 */
async function getManagedSocieties(userId: string) {
  return prisma.userSociety.findMany({
    where: {
      userId,
      role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] },
      society: { isActive: true },
    },
    select: {
      society: { select: { id: true, name: true } },
    },
  });
}

async function buildSocietyBlock(societyId: string, societyName: string, now: Date): Promise<DigestSocietyBlock> {
  const in30Days = new Date(now.getTime() + 30 * DAY_MS);
  const yesterday = new Date(now.getTime() - 1 * DAY_MS);

  const [drafts, overdue, revisions, leasesEnding, documentsExpiring, emailFailed] = await Promise.all([
    prisma.invoice.count({
      where: { societyId, status: "BROUILLON" },
    }),
    prisma.invoice.findMany({
      where: {
        societyId,
        status: { in: ["EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE"] },
        invoiceType: { notIn: ["AVOIR", "QUITTANCE"] },
        dueDate: { lt: now },
      },
      select: {
        totalTTC: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.rentRevision.count({
      where: {
        isValidated: false,
        lease: { societyId, status: "EN_COURS" },
      },
    }),
    prisma.lease.count({
      where: {
        societyId,
        status: "EN_COURS",
        deletedAt: null,
        endDate: { gte: now, lte: in30Days },
      },
    }),
    prisma.document.count({
      where: {
        societyId,
        deletedAt: null,
        expiresAt: { gte: now, lte: in30Days },
      },
    }),
    prisma.emailDeliveryProof.count({
      where: {
        societyId,
        status: { in: ["FAILED", "BOUNCED"] },
        sentAt: { gte: yesterday },
      },
    }),
  ]);

  const overdueCount = overdue.length;
  const overdueRemaining = overdue.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    return sum + Math.max(0, inv.totalTTC - paid);
  }, 0);

  return {
    societyId,
    societyName,
    drafts,
    overdueInvoices: {
      count: overdueCount,
      totalRemaining: Math.round(overdueRemaining * 100) / 100,
    },
    pendingRevisions: revisions,
    leasesEndingSoon: leasesEnding,
    documentsExpiringSoon: documentsExpiring,
    emailDeliveryIssues: emailFailed,
  };
}

export async function buildDailyDigestForUser(userId: string, now: Date = new Date()): Promise<DailyDigest | null> {
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, name: true, isActive: true, dailyDigestEnabled: true },
    }),
    getManagedSocieties(userId),
  ]);

  if (!user || !user.isActive || !user.dailyDigestEnabled) return null;
  if (memberships.length === 0) return null;

  const blocks = await Promise.all(
    memberships.map((m) => buildSocietyBlock(m.society.id, m.society.name, now))
  );

  const totals = blocks.reduce(
    (acc, b) => ({
      drafts: acc.drafts + b.drafts,
      overdueInvoices: acc.overdueInvoices + b.overdueInvoices.count,
      overdueRemaining: acc.overdueRemaining + b.overdueInvoices.totalRemaining,
      pendingRevisions: acc.pendingRevisions + b.pendingRevisions,
      leasesEndingSoon: acc.leasesEndingSoon + b.leasesEndingSoon,
      documentsExpiringSoon: acc.documentsExpiringSoon + b.documentsExpiringSoon,
      emailDeliveryIssues: acc.emailDeliveryIssues + b.emailDeliveryIssues,
      grandTotal: 0,
    }),
    {
      drafts: 0,
      overdueInvoices: 0,
      overdueRemaining: 0,
      pendingRevisions: 0,
      leasesEndingSoon: 0,
      documentsExpiringSoon: 0,
      emailDeliveryIssues: 0,
      grandTotal: 0,
    }
  );
  totals.grandTotal =
    totals.drafts +
    totals.overdueInvoices +
    totals.pendingRevisions +
    totals.leasesEndingSoon +
    totals.documentsExpiringSoon +
    totals.emailDeliveryIssues;
  // Arrondi net
  totals.overdueRemaining = Math.round(totals.overdueRemaining * 100) / 100;

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || null;

  return {
    userId: user.id,
    userEmail: user.email,
    userName: displayName,
    societies: blocks,
    totals,
  };
}

/** Identifie tous les utilisateurs éligibles pour le digest quotidien. */
export async function getEligibleUserIdsForDigest(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      dailyDigestEnabled: true,
      userSocieties: {
        some: {
          role: { in: ["ADMIN_SOCIETE", "GESTIONNAIRE"] },
          society: { isActive: true },
        },
      },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
