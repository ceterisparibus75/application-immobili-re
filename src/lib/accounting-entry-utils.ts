export type JournalEntryAmountLine = {
  debit: string | number | null | undefined;
  credit: string | number | null | undefined;
};

export type JournalEntryTotals = {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
};

export type JournalEntryBalancePatch = {
  debit: string;
  credit: string;
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number): string {
  return roundCents(value).toFixed(2);
}

export function calculateJournalEntryTotals(lines: JournalEntryAmountLine[]): JournalEntryTotals {
  const totalDebit = roundCents(lines.reduce((sum, line) => sum + parseAmount(line.debit), 0));
  const totalCredit = roundCents(lines.reduce((sum, line) => sum + parseAmount(line.credit), 0));
  const difference = roundCents(Math.abs(totalDebit - totalCredit));

  return {
    totalDebit,
    totalCredit,
    difference,
    isBalanced: difference <= 0.01 && totalDebit > 0,
  };
}

export function getBalancingPatch(lines: JournalEntryAmountLine[]): JournalEntryBalancePatch | null {
  const totals = calculateJournalEntryTotals(lines);
  if (totals.isBalanced || totals.difference <= 0.01) return null;

  if (totals.totalDebit > totals.totalCredit) {
    return { debit: "", credit: formatAmount(totals.totalDebit - totals.totalCredit) };
  }

  return { debit: formatAmount(totals.totalCredit - totals.totalDebit), credit: "" };
}
