/**
 * Construction du relevé locatif chronologique — isomorphe (client ET serveur).
 * Même source de vérité pour l'affichage dans la fiche locataire, l'export
 * CSV et la génération PDF du décompte à envoyer au locataire.
 */

import { getCreditNoteAmount } from "@/actions/tenant-shared";

export interface StatementInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  status: string;
  issueDate: string;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalTTC: number;
}

export interface StatementAdjustment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  reference: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
  balanceAfter: number | null;
}

export interface StatementBankFlow {
  id: string;
  transactionDate: string;
  label: string;
  reference: string | null;
  transactionAmount: number;
  invoiceNumbers: string[];
  adjustmentLabels: string[];
}

export interface StatementManualPayment {
  id: string;
  paidAt: string;
  amount: number;
  method: string | null;
  reference: string | null;
  invoiceNumber: string | null;
}

export interface StatementMovement {
  date: string;
  label: string;
  type: "debit" | "credit";
  amount: number;
  balance: number;
  invoiceNumber?: string;
  status?: string;
  kind: "adjustment" | "invoice" | "payment";
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  APPEL_LOYER: "Appel de loyer",
  QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régularisation",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
};

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const sd = new Date(start);
  const ed = new Date(end);
  const sameYear = sd.getFullYear() === ed.getFullYear();
  const sameMonth = sameYear && sd.getMonth() === ed.getMonth();
  const month = sd.toLocaleDateString("fr-FR", { month: "short" });
  const year = sd.getFullYear();
  if (sameMonth) return `${month} ${year}`;
  const monthEnd = ed.toLocaleDateString("fr-FR", { month: "short" });
  if (sameYear) return `${month} – ${monthEnd} ${year}`;
  return `${month} ${year} – ${monthEnd} ${ed.getFullYear()}`;
}

export function buildStatementMovements(
  invoices: StatementInvoice[],
  adjustments: StatementAdjustment[],
  bankFlows: StatementBankFlow[],
  manualPayments: StatementManualPayment[],
): StatementMovement[] {
  type Raw = Omit<StatementMovement, "balance"> & {
    balanceAfter?: number | null;
  };
  const movements: Raw[] = [];

  for (const adjustment of adjustments) {
    const period = adjustment.periodLabel || formatPeriod(adjustment.periodStart, adjustment.periodEnd);
    const suffix = [
      period ? `Période ${period}` : null,
      adjustment.reference ? `Réf. ${adjustment.reference}` : null,
      adjustment.notes,
    ].filter(Boolean).join(" · ");
    movements.push({
      date: adjustment.dueDate,
      label: suffix ? `${adjustment.label} — ${suffix}` : adjustment.label,
      type: adjustment.amount >= 0 ? "debit" : "credit",
      amount: Math.abs(adjustment.amount),
      balanceAfter: adjustment.balanceAfter,
      kind: "adjustment",
    });
  }

  for (const inv of invoices) {
    if (inv.status === "ANNULEE" || inv.status === "BROUILLON") continue;
    if (inv.invoiceType === "QUITTANCE") continue;

    const typeLabel = INVOICE_TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType;
    const period = formatPeriod(inv.periodStart, inv.periodEnd);
    const label = period ? `${typeLabel} — ${period}` : typeLabel;

    if (inv.invoiceType === "AVOIR") {
      movements.push({
        date: inv.issueDate,
        label,
        type: "credit",
        amount: getCreditNoteAmount(inv.totalTTC),
        invoiceNumber: inv.invoiceNumber ?? undefined,
        status: inv.status,
        kind: "invoice",
      });
    } else {
      movements.push({
        date: inv.issueDate,
        label,
        type: "debit",
        amount: inv.totalTTC,
        invoiceNumber: inv.invoiceNumber ?? undefined,
        status: inv.status,
        kind: "invoice",
      });
    }
  }

  for (const flow of bankFlows) {
    const covers = [...flow.invoiceNumbers, ...flow.adjustmentLabels];
    const coversTag = covers.length ? ` (règle ${covers.join(", ")})` : "";
    const refBits = flow.reference ? ` — Réf: ${flow.reference}` : "";
    movements.push({
      date: flow.transactionDate,
      label: `Virement ${flow.label}${refBits}${coversTag}`,
      type: "credit",
      amount: flow.transactionAmount,
      kind: "payment",
    });
  }

  for (const p of manualPayments) {
    const methodBits = p.method ? ` (${p.method})` : "";
    const refBits = p.reference ? ` — Réf: ${p.reference}` : "";
    const invoiceBits = p.invoiceNumber ? ` — ${p.invoiceNumber}` : "";
    movements.push({
      date: p.paidAt,
      label: `Paiement manuel${invoiceBits}${methodBits}${refBits}`,
      type: "credit",
      amount: p.amount,
      kind: "payment",
    });
  }

  movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  return movements.map((m) => {
    if (typeof m.balanceAfter === "number") {
      runningBalance = m.balanceAfter;
    } else if (m.type === "debit") {
      runningBalance += m.amount;
    } else {
      runningBalance -= m.amount;
    }
    const { balanceAfter: _balanceAfter, ...rest } = m;
    void _balanceAfter;
    return { ...rest, balance: Math.round(runningBalance * 100) / 100 };
  });
}

export function summarizeStatement(movements: StatementMovement[]): {
  totalDebit: number;
  totalCredit: number;
  balance: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const m of movements) {
    if (m.type === "debit") totalDebit += m.amount;
    else totalCredit += m.amount;
  }
  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    balance: movements.length > 0 ? movements[movements.length - 1].balance : 0,
  };
}
