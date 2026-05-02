export function getBankTransactionSourceLink(input: {
  bankAccountId: string;
  transactionDate: Date | string;
}): string {
  const date = new Date(input.transactionDate);
  const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `/banque/${input.bankAccountId}?period=month&month=${month}`;
}
