const REPORT_ACTIVE_LEASE_STATUSES = ["EN_COURS", "RENOUVELE"] as const;
const REPORT_FINANCIAL_LEASE_STATUSES = ["EN_COURS", "RENOUVELE", "RESILIE", "CONTENTIEUX"] as const;

export function getActiveLeaseWhere(asOf = new Date()) {
  return {
    deletedAt: null,
    status: { in: [...REPORT_ACTIVE_LEASE_STATUSES] },
    startDate: { lte: asOf },
  };
}

export function getLeaseOverlapWhere(from: Date, to: Date) {
  return {
    deletedAt: null,
    status: { in: [...REPORT_FINANCIAL_LEASE_STATUSES] },
    startDate: { lte: to },
    endDate: { gte: from },
    OR: [
      { exitDate: null },
      { exitDate: { gte: from } },
    ],
  };
}