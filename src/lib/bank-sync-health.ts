import { prisma } from "@/lib/prisma";

/**
 * Diagnostic de santé de la synchronisation bancaire.
 * Distingue trois signaux :
 *  - consentement PSD2 arrivant à expiration ou déjà expiré (Powens : 90 j)
 *  - dernière tentative de sync trop ancienne (cron muet ou en erreur)
 *  - erreur remontée par l'API bancaire au dernier passage
 */
export type BankSyncHealthAlert = {
  bankAccountId: string;
  connectionId: string | null;
  accountName: string;
  bankName: string;
  provider: "POWENS" | "QONTO" | "OTHER";
  severity: "warning" | "danger";
  kind: "expiring" | "expired" | "stale" | "error";
  message: string;
  detail: string | null;
  lastSyncAt: Date | null;
  lastSyncAttemptAt: Date | null;
  expiresAt: Date | null;
};

const EXPIRY_WARNING_DAYS = 15;
const STALE_ATTEMPT_HOURS = 48;

function providerFrom(value: string | null | undefined): BankSyncHealthAlert["provider"] {
  if (value === "POWENS") return "POWENS";
  if (value === "QONTO") return "QONTO";
  return "OTHER";
}

function humanDelay(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} jour${days > 1 ? "s" : ""}`;
}

export async function getBankSyncHealthAlerts(societyId: string): Promise<BankSyncHealthAlert[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { societyId, isActive: true },
    select: {
      id: true,
      accountName: true,
      bankName: true,
      lastSyncAt: true,
      lastSyncAttemptAt: true,
      lastSyncError: true,
      connectionId: true,
      connection: {
        select: { provider: true, status: true, expiresAt: true },
      },
    },
  });

  const now = new Date();
  const alerts: BankSyncHealthAlert[] = [];

  for (const account of accounts) {
    const connection = account.connection;
    // On ignore les comptes purement manuels (pas de provider)
    if (!connection) continue;
    const provider = providerFrom(connection.provider);
    if (provider === "OTHER") continue;

    const base = {
      bankAccountId: account.id,
      connectionId: account.connectionId,
      accountName: account.accountName,
      bankName: account.bankName,
      provider,
      lastSyncAt: account.lastSyncAt,
      lastSyncAttemptAt: account.lastSyncAttemptAt,
      expiresAt: connection.expiresAt,
    };

    // 1. Erreur remontée au dernier passage — le plus grave, affiché prioritairement
    if (account.lastSyncError) {
      alerts.push({
        ...base,
        severity: "danger",
        kind: "error",
        message: "Synchronisation en erreur",
        detail: account.lastSyncError,
      });
      continue;
    }

    // 2. Consentement PSD2 expiré ou proche de l'être (Powens surtout)
    if (connection.expiresAt) {
      const expiresAt = connection.expiresAt;
      if (expiresAt.getTime() <= now.getTime()) {
        alerts.push({
          ...base,
          severity: "danger",
          kind: "expired",
          message: "Consentement bancaire expiré",
          detail: `Renouvellement requis pour reprendre la synchronisation (mandat PSD2 expiré le ${expiresAt.toLocaleDateString("fr-FR")}).`,
        });
        continue;
      }
      const daysUntil = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
      if (daysUntil <= EXPIRY_WARNING_DAYS) {
        alerts.push({
          ...base,
          severity: "warning",
          kind: "expiring",
          message: `Consentement à renouveler dans ${daysUntil} jour${daysUntil > 1 ? "s" : ""}`,
          detail: `Après le ${expiresAt.toLocaleDateString("fr-FR")}, la synchronisation Powens sera bloquée sans nouveau consentement PSD2.`,
        });
        continue;
      }
    }

    // 3. Sync silencieuse — le cron n'a pas tenté depuis > 48h
    //    (ou n'a jamais tenté depuis l'ajout du champ)
    if (!account.lastSyncAttemptAt) {
      // On ne veut pas alerter tant que le champ n'a jamais été rempli
      // sur des comptes existants : attendre la première tentative.
      continue;
    }
    const hoursSinceAttempt = (now.getTime() - account.lastSyncAttemptAt.getTime()) / 3_600_000;
    if (hoursSinceAttempt >= STALE_ATTEMPT_HOURS) {
      alerts.push({
        ...base,
        severity: "warning",
        kind: "stale",
        message: `Aucune tentative de sync depuis ${humanDelay(account.lastSyncAttemptAt, now)}`,
        detail: "Le cron quotidien n'a rien remonté récemment — vérifier l'état de la connexion et lancer un sync manuel.",
      });
    }
  }

  // Danger d'abord, puis warning
  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "danger" ? -1 : 1;
    return 0;
  });
}
