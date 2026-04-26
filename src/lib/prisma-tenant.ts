import { prisma } from "./prisma";

// Modèles qui ont un societyId direct (pas via une relation)
const MODELS_WITH_DIRECT_SOCIETY_ID: string[] = [
  // Patrimoine
  "Building",
  "AdditionalAcquisition",
  "Copropriete",
  "SeasonalProperty",
  // Baux et locataires
  "Lease",
  "LeaseTemplate",
  "Tenant",
  "Candidate",
  "CandidatePipeline",
  // Facturation et paiements
  "Invoice",
  "SupplierInvoice",
  "SepaMandate",
  // Charges et comptabilité
  "Charge",
  "ChargeCategory",
  "ChargeRegularization",
  "AccountingAccount",
  "JournalEntry",
  "FiscalYear",
  "BudgetLine",
  "ThirdPartyStatement",
  "ManagementReport",
  // Banque
  "BankAccount",
  "BankConnection",
  "MatchingRule",
  "TransactionAutoTag",
  // Suivi
  "ReminderScenario",
  "ReportSchedule",
  "Workflow",
  "Ticket",
  "Notification",
  // Documents et signatures
  "Document",
  "AuditLog",
  "LetterTemplate",
  "SignatureRequest",
  "Dataroom",
  // Communication
  "Announcement",
  // RGPD
  "GdprRequest",
  // Évaluation
  "PropertyValuation",
  "RentValuation",
  "Loan",
];

/**
 * Crée un client Prisma étendu qui filtre automatiquement par societyId.
 *
 * Attention:
 * - ce helper n'est sûr que pour les modèles avec `societyId` direct
 * - il ne couvre pas les modèles scopés via relation (`Lot`, `Payment`, etc.)
 * - il ne doit pas être branché globalement sans revue fine des opérations Prisma
 */
export function createTenantPrisma(societyId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || !MODELS_WITH_DIRECT_SOCIETY_ID.includes(model)) {
          return query(args);
        }

        // Lectures : injecter le filtre societyId
        if (
          [
            "findMany",
            "findFirst",
            "findUnique",
            "findFirstOrThrow",
            "findUniqueOrThrow",
            "count",
            "aggregate",
            "groupBy",
          ].includes(operation)
        ) {
          args.where = { ...args.where, societyId };
        }

        // Création : injecter le societyId dans les données
        if (operation === "create") {
          args.data = { ...args.data, societyId };
        }

        if (operation === "createMany") {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d: Record<string, unknown>) => ({
              ...d,
              societyId,
            }));
          } else {
            args.data = { ...args.data, societyId };
          }
        }

        // Mises à jour et suppressions : filtrer par societyId
        if (
          ["update", "updateMany", "delete", "deleteMany", "upsert"].includes(
            operation
          )
        ) {
          if (operation === "upsert") {
            args.where = { ...args.where, societyId };
            args.create = { ...args.create, societyId };
          } else {
            args.where = { ...args.where, societyId };
          }
        }

        return query(args);
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;
