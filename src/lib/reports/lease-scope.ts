import type { Prisma } from "@/generated/prisma/client";

const REPORT_ACTIVE_LEASE_STATUSES = ["EN_COURS", "RENOUVELE"] as const;
const REPORT_FINANCIAL_LEASE_STATUSES = ["EN_COURS", "RENOUVELE", "RESILIE", "CONTENTIEUX"] as const;

export function getActiveLeaseWhere(asOf = new Date()): Prisma.LeaseWhereInput {
  return {
    deletedAt: null,
    status: { in: [...REPORT_ACTIVE_LEASE_STATUSES] },
    startDate: { lte: asOf },
  };
}

export function getLeaseOverlapWhere(from: Date, to: Date): Prisma.LeaseWhereInput {
  return {
    deletedAt: null,
    status: { in: [...REPORT_FINANCIAL_LEASE_STATUSES] },
    startDate: { lte: to },
    // Inclut les baux en tacite reconduction (EN_COURS/RENOUVELE dont endDate est passée)
    // en les ajoutant comme branches OR indépendantes avec exitDate null/valide.
    OR: [
      { endDate: { gte: from }, exitDate: null },
      { endDate: { gte: from }, exitDate: { gte: from } },
      { status: { in: ["EN_COURS", "RENOUVELE"] }, exitDate: null },
      { status: { in: ["EN_COURS", "RENOUVELE"] }, exitDate: { gte: from } },
    ],
  };
}