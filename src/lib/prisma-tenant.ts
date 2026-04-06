import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Liste des modèles Prisma scopés par societyId.
 * Chaque requête sur ces modèles sera automatiquement filtrée.
 */
const TENANT_SCOPED_MODELS: Prisma.ModelName[] = [
  "Society",
  "Building",
  "Lot",
  "Lease",
  "Tenant",
  "TenantContact",
  "TenantDocument",
  "Guarantee",
  "TenantPortalAccess",
  "Invoice",
  "InvoiceLine",
  "Payment",
  "Charge",
  "ChargeCategory",
  "ChargeProvision",
  "ChargeRegularization",
  "BankAccount",
  "BankTransaction",
  "AccountingAccount",
  "JournalEntry",
  "ReminderScenario",
  "ReminderStep",
  "Reminder",
  "Contact",
  "ContactNote",
  "Message",
  "Announcement",
  "AnnouncementPhoto",
  "AnnouncementPublication",
  "Document",
  "AuditLog",
  "LetterTemplate",
  "DepositMovement",
  "PropertyValuation",
  "RentValuation",
];

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
 * Utilisé dans toutes les Server Actions et API Routes pour garantir
 * l'isolation des données entre sociétés.
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
