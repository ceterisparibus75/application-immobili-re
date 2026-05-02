import type { AccountReviewRow } from "@/actions/account-review";

export function filterAccountReviewRows(
  rows: AccountReviewRow[],
  showEmptyAccounts: boolean,
  cycle?: string
): AccountReviewRow[] {
  const cycleRows = cycle && cycle !== "all"
    ? rows.filter((row) => row.cycle === cycle)
    : rows;

  if (showEmptyAccounts) return cycleRows;

  return cycleRows.filter((row) =>
    Math.abs(row.totalDebit) > 0.01 || Math.abs(row.totalCredit) > 0.01
  );
}
