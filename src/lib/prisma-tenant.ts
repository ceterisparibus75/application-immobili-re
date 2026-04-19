import { prisma } from "./prisma";

// Modèles qui ont un societyId direct (pas via une relation)
const MODELS_WITH_DIRECT_SOCIETY_ID: string[] = [
  "Building",
  "Lease",
  "Tenant",
  "Invoice",
  "Charge",
  "ChargeCategory",
  "BankAccount",
  "AccountingAccount",
  "JournalEntry",
  "ReminderScenario",
  "Contact",
  "Message",
  "Announcement",
  "Document",
  "AuditLog",
  "LetterTemplate",
  "PropertyValuation",
  "RentValuation",
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
