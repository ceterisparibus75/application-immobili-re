import type { AccountReviewRow } from "@/actions/account-review";

export function filterAccountReviewRows(
  rows: AccountReviewRow[],
  showEmptyAccounts: boolean
): AccountReviewRow[] {
  if (showEmptyAccounts) return rows;

  return rows.filter((row) =>
    Math.abs(row.totalDebit) > 0.01 || Math.abs(row.totalCredit) > 0.01
  );
}
