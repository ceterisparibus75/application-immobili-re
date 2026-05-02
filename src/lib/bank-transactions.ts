type MonthlyTransaction = {
  id: string;
  transactionDate: Date | string;
  amount: number;
};

export type MonthlyTransactionGroup<T extends MonthlyTransaction> = {
  monthKey: string;
  label: string;
  count: number;
  totalCredit: number;
  totalDebit: number;
  net: number;
  transactions: T[];
};

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMonthlyTransactionGroups<T extends MonthlyTransaction>(
  transactions: T[]
): MonthlyTransactionGroup<T>[] {
  const groups = new Map<string, MonthlyTransactionGroup<T>>();

  for (const transaction of transactions) {
    const date = new Date(transaction.transactionDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = groups.get(monthKey);
    const group = existing ?? {
      monthKey,
      label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date),
      count: 0,
      totalCredit: 0,
      totalDebit: 0,
      net: 0,
      transactions: [],
    };

    group.count += 1;
    if (transaction.amount >= 0) group.totalCredit = roundCents(group.totalCredit + transaction.amount);
    else group.totalDebit = roundCents(group.totalDebit + transaction.amount);
    group.net = roundCents(group.totalCredit + group.totalDebit);
    group.transactions.push(transaction);
    groups.set(monthKey, group);
  }

  return [...groups.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
