"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Plus,
  Receipt,
  Upload,
  Wallet,
} from "lucide-react";
import { useState, useTransition } from "react";
import { createTenantBalanceAdjustment, importTenantLedgerStatement } from "@/actions/tenant-mutations";
import { duplicateInvoiceAsDraft, validateInvoice } from "@/actions/invoice";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
}

interface AccountInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceType: string;
  status: string;
  issueDate: string;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
  payments: Payment[];
}

interface BalanceAdjustment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  notes: string | null;
  reference: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  balanceAfter: number | null;
  source: string;
  isReconciled?: boolean;
  reconciledAt?: string | null;
  reconciledBankTransactionId?: string | null;
  bankTransaction?: {
    id: string;
    transactionDate: string;
    amount: number;
    label: string;
    reference: string | null;
  } | null;
}

interface LedgerImportLine {
  date: string;
  label: string;
  debit: number;
  credit: number;
  balanceAfter?: number;
  reference?: string;
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
}

interface BankOverpayment {
  id: string;
  transactionDate: string;
  label: string;
  reference: string | null;
  transactionAmount: number;
  allocatedToTenant: number;
  unallocated: number;
  invoiceNumbers: string[];
}

interface TenantAccountProps {
  tenantId: string;
  societyId: string;
  invoices: AccountInvoice[];
  adjustments: BalanceAdjustment[];
  bankOverpayments: BankOverpayment[];
  balance: number;
  tenantName: string;
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  APPEL_LOYER: "Appel de loyer",
  QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régularisation",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
};

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  BROUILLON: "Brouillon",
  VALIDEE: "Validée",
  ENVOYEE: "Envoyée",
  RELANCEE: "Relancée",
  PAYE: "Payée",
  PARTIELLEMENT_PAYE: "Partiel",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
  IRRECOUVRABLE: "Irrecouvrable",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  EN_ATTENTE: "secondary",
  BROUILLON: "secondary",
  VALIDEE: "default",
  ENVOYEE: "default",
  RELANCEE: "warning",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive",
  ANNULEE: "secondary",
  IRRECOUVRABLE: "destructive",
};

type InvoiceFilter = "ALL" | "DRAFTS" | "PENDING" | "ISSUED" | "OVERDUE" | "CREDITS";

const INVOICE_FILTERS: Array<{ value: InvoiceFilter; label: string }> = [
  { value: "ALL", label: "Toutes" },
  { value: "DRAFTS", label: "Brouillons" },
  { value: "PENDING", label: "En attente" },
  { value: "ISSUED", label: "Émises" },
  { value: "OVERDUE", label: "En retard" },
  { value: "CREDITS", label: "Avoirs" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCreditNoteAmount(amount: number): number {
  return Math.abs(amount);
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const mois = s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  if (!e || s.getMonth() === e.getMonth()) return mois;
  return `${s.toLocaleDateString("fr-FR", { month: "short" })} - ${e.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`;
}

function getInvoiceAmount(invoice: AccountInvoice): number {
  return invoice.invoiceType === "AVOIR" ? -getCreditNoteAmount(invoice.totalTTC) : invoice.totalTTC;
}

function matchesInvoiceFilter(invoice: AccountInvoice, filter: InvoiceFilter): boolean {
  switch (filter) {
    case "DRAFTS":
      return invoice.status === "BROUILLON";
    case "PENDING":
      return invoice.status === "EN_ATTENTE";
    case "ISSUED":
      return !["BROUILLON", "ANNULEE"].includes(invoice.status);
    case "OVERDUE":
      return invoice.status === "EN_RETARD" || invoice.status === "RELANCEE";
    case "CREDITS":
      return invoice.invoiceType === "AVOIR";
    default:
      return true;
  }
}

function matchesInvoiceSearch(invoice: AccountInvoice, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const period = formatPeriod(invoice.periodStart, invoice.periodEnd);
  const haystack = [
    invoice.invoiceNumber ?? "brouillon",
    INVOICE_TYPE_LABELS[invoice.invoiceType] ?? invoice.invoiceType,
    STATUS_LABELS[invoice.status] ?? invoice.status,
    period,
    formatCurrency(getInvoiceAmount(invoice)),
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findCell(row: Record<string, unknown>, aliases: string[]): string {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.includes(normalizeHeader(key))) {
      return String(value ?? "").trim();
    }
  }
  return "";
}

function parseMoney(value: string): number | null {
  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(/[€$]/g, "")
    .replace(",", ".")
    .trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const french = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (french) {
    const year = french[3].length === 2 ? `20${french[3]}` : french[3];
    return `${year}-${french[2].padStart(2, "0")}-${french[1].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parsePeriod(value: string): { periodLabel?: string; periodStart?: string; periodEnd?: string } {
  const periodLabel = value.trim() || undefined;
  if (!periodLabel) return {};
  const monthYear = periodLabel.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) {
    const year = Number(monthYear[2]);
    const month = Number(monthYear[1]);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return {
      periodLabel,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }
  return { periodLabel };
}

/**
 * Construit les mouvements chronologiques pour le relevé locatif.
 * Chaque facture = débit (ou crédit si avoir), chaque paiement = crédit.
 */
function buildMovements(
  invoices: AccountInvoice[],
  adjustments: BalanceAdjustment[],
  bankOverpayments: BankOverpayment[] = [],
) {
  const movements: Array<{
    date: string;
    label: string;
    type: "debit" | "credit";
    amount: number;
    invoiceId?: string;
    invoiceNumber?: string;
    status?: string;
    balanceAfter?: number | null;
  }> = [];

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
    });

    // Si la reprise a été soldée par un virement, on affiche aussi la ligne
    // de paiement pour expliciter la sortie de solde.
    if (adjustment.isReconciled && adjustment.bankTransaction) {
      const tx = adjustment.bankTransaction;
      const ref = tx.reference ? ` — Réf: ${tx.reference}` : "";
      movements.push({
        date: tx.transactionDate,
        label: `Paiement reprise — ${adjustment.label}${ref}`,
        type: adjustment.amount >= 0 ? "credit" : "debit",
        amount: Math.abs(adjustment.amount),
      });
    }
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
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber ?? undefined,
        status: inv.status,
      });
    } else {
      movements.push({
        date: inv.issueDate,
        label,
        type: "debit",
        amount: inv.totalTTC,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber ?? undefined,
        status: inv.status,
      });
    }

    // Paiements
    for (const p of inv.payments) {
      movements.push({
        date: p.paidAt,
        label: `Paiement ${inv.invoiceNumber}${p.method ? ` (${p.method})` : ""}${p.reference ? ` — Réf: ${p.reference}` : ""}`,
        type: "credit",
        amount: p.amount,
      });
    }
  }

  // Surplus bancaires : encaissement > affectation aux factures. On le
  // remonte comme un crédit distinct pour rendre visible l'avoir du locataire
  // (ex: virement 4 000 € pour une facture de 3 728,21 € → 271,79 € de crédit
  // non affecté visible dans le solde).
  for (const op of bankOverpayments) {
    const refBits = [op.reference ? `Réf: ${op.reference}` : null].filter(Boolean).join(" — ");
    const invoicesTag = op.invoiceNumbers.length
      ? ` (au-delà de ${op.invoiceNumbers.join(", ")})`
      : "";
    movements.push({
      date: op.transactionDate,
      label: `Encaissement non affecté — ${op.label}${refBits ? ` — ${refBits}` : ""}${invoicesTag}`,
      type: "credit",
      amount: op.unallocated,
    });
  }

  // Trier par date croissante
  movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculer le solde courant
  let runningBalance = 0;
  return movements.map((m) => {
    if (typeof m.balanceAfter === "number") {
      runningBalance = m.balanceAfter;
    } else if (m.type === "debit") {
      runningBalance += m.amount;
    } else {
      runningBalance -= m.amount;
    }
    return { ...m, balance: Math.round(runningBalance * 100) / 100 };
  });
}

export function TenantAccount({
  tenantId,
  societyId,
  invoices,
  adjustments,
  bankOverpayments,
  balance,
  tenantName,
}: TenantAccountProps) {
  const movements = buildMovements(invoices, adjustments, bankOverpayments);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("ALL");
  const [validatingInvoiceId, setValidatingInvoiceId] = useState<string | null>(null);
  const [duplicatingInvoiceId, setDuplicatingInvoiceId] = useState<string | null>(null);
  const billingInvoices = invoices
    .filter((invoice) => matchesInvoiceFilter(invoice, invoiceFilter))
    .filter((invoice) => matchesInvoiceSearch(invoice, invoiceSearch))
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

  // Résumé — inclut les reprises de solde (TenantBalanceAdjustment) à débit
  // et leur paiement éventuel à crédit, pour rester en phase avec le tableau.
  const totalFacture = invoices
    .filter((i) => i.status !== "ANNULEE" && i.status !== "BROUILLON" && i.invoiceType !== "AVOIR" && i.invoiceType !== "QUITTANCE")
    .reduce((s, i) => s + i.totalTTC, 0)
    + adjustments.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);
  const totalAvoir = invoices
    .filter((i) => i.status !== "ANNULEE" && i.status !== "BROUILLON" && i.invoiceType === "AVOIR")
    .reduce((s, i) => s + getCreditNoteAmount(i.totalTTC), 0)
    + adjustments.filter((a) => a.amount < 0).reduce((s, a) => s + Math.abs(a.amount), 0);
  const totalPaiements = invoices
    .filter((i) => i.status !== "ANNULEE" && i.status !== "BROUILLON" && i.invoiceType !== "QUITTANCE")
    .reduce((s, i) => s + i.payments.reduce((ps, p) => ps + p.amount, 0), 0)
    + adjustments.filter((a) => a.isReconciled && a.amount > 0).reduce((s, a) => s + a.amount, 0)
    + bankOverpayments.reduce((s, op) => s + op.unallocated, 0);

  // Import de solde précédent
  const [showDebitDialog, setShowDebitDialog] = useState(false);
  const [debitForm, setDebitForm] = useState({
    label: "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [showLedgerImportDialog, setShowLedgerImportDialog] = useState(false);
  const [ledgerFileName, setLedgerFileName] = useState("");
  const [ledgerImportLines, setLedgerImportLines] = useState<LedgerImportLine[]>([]);
  const [ledgerImportErrors, setLedgerImportErrors] = useState<string[]>([]);

  async function handleCreateDebit() {
    if (!debitForm.label || !debitForm.amount) return;
    startTransition(async () => {
      const result = await createTenantBalanceAdjustment(societyId, {
        tenantId,
        label: debitForm.label,
        amount: debitForm.amount,
        dueDate: debitForm.dueDate,
        notes: debitForm.notes || undefined,
      });
      if (result.success) {
        toast.success("Solde précédent importé");
        setShowDebitDialog(false);
        setDebitForm({ label: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), notes: "" });
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  async function handleLedgerFile(file: File) {
    setLedgerFileName(file.name);
    setLedgerImportLines([]);
    setLedgerImportErrors([]);

    const text = await file.text();
    const Papa = await import("papaparse");
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const errors: string[] = parsed.errors.map((error) => `Ligne ${error.row ?? "?"} : ${error.message}`);
    const lines: LedgerImportLine[] = [];

    parsed.data.forEach((row, index) => {
      const rowNumber = index + 2;
      const date = parseDateValue(findCell(row, ["date", "date mouvement", "date opération", "date operation", "echeance", "échéance"]));
      const label = findCell(row, ["libellé", "libelle", "label", "description", "opération", "operation", "intitulé", "intitule"]);
      const debit = parseMoney(findCell(row, ["débit", "debit", "doit", "montant débit", "montant debit"])) ?? 0;
      const credit = parseMoney(findCell(row, ["crédit", "credit", "avoir", "paiement", "montant crédit", "montant credit"])) ?? 0;
      const balanceAfter = parseMoney(findCell(row, ["solde", "solde après", "solde apres", "balance", "balance after"])) ?? undefined;
      const reference = findCell(row, ["référence", "reference", "ref", "pièce", "piece"]);
      const period = parsePeriod(findCell(row, ["période", "periode", "period", "mois", "terme"]));
      const periodStart = parseDateValue(findCell(row, ["début période", "debut periode", "period start", "date début", "date debut"])) ?? period.periodStart;
      const periodEnd = parseDateValue(findCell(row, ["fin période", "fin periode", "period end", "date fin"])) ?? period.periodEnd;

      if (!date) {
        errors.push(`Ligne ${rowNumber} : date absente ou invalide`);
        return;
      }
      if (!label) {
        errors.push(`Ligne ${rowNumber} : libellé absent`);
        return;
      }
      if (debit === 0 && credit === 0) {
        errors.push(`Ligne ${rowNumber} : débit ou crédit requis`);
        return;
      }

      lines.push({
        date,
        label,
        debit: Math.abs(debit),
        credit: Math.abs(credit),
        balanceAfter,
        reference: reference || undefined,
        periodLabel: period.periodLabel,
        periodStart,
        periodEnd,
      });
    });

    setLedgerImportLines(lines);
    setLedgerImportErrors(errors.slice(0, 20));
  }

  async function handleImportLedgerStatement() {
    if (ledgerImportLines.length === 0) return;
    startTransition(async () => {
      const result = await importTenantLedgerStatement(societyId, {
        tenantId,
        lines: ledgerImportLines,
      });
      if (result.success) {
        toast.success(`${result.data?.imported ?? ledgerImportLines.length} ligne(s) importée(s)`);
        setShowLedgerImportDialog(false);
        setLedgerFileName("");
        setLedgerImportLines([]);
        setLedgerImportErrors([]);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleValidateInvoice(invoiceId: string) {
    setValidatingInvoiceId(invoiceId);
    startTransition(async () => {
      const result = await validateInvoice(societyId, invoiceId);
      if (result.success) {
        toast.success(`Facture validée${result.data?.invoiceNumber ? ` : ${result.data.invoiceNumber}` : ""}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur de validation");
      }
      setValidatingInvoiceId(null);
    });
  }

  function handleDuplicateInvoice(invoiceId: string) {
    setDuplicatingInvoiceId(invoiceId);
    startTransition(async () => {
      const result = await duplicateInvoiceAsDraft(societyId, invoiceId);
      if (result.success) {
        toast.success("Brouillon dupliqué dans le module Facturation");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la duplication");
      }
      setDuplicatingInvoiceId(null);
    });
  }

  // Export CSV du relevé
  function exportCsv() {
    const header = "Date;Libellé;Débit;Crédit;Solde\n";
    const rows = movements.map((m) =>
      [
        formatDate(m.date),
        `"${m.label}"`,
        m.type === "debit" ? formatCurrency(m.amount) : "",
        m.type === "credit" ? formatCurrency(m.amount) : "",
        formatCurrency(m.balance),
      ].join(";")
    );
    const csv = "\uFEFF" + header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toLocaleDateString("fr-FR").replace(/\//g, "-");
    a.download = `releve-locatif-${tenantName.replace(/\s+/g, "-").toLowerCase()}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Suivi financier locataire
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="facturation" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:w-[520px]">
            <TabsTrigger value="facturation" className="gap-2">
              <Receipt className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="compte" className="gap-2">
              <Wallet className="h-4 w-4" />
              Compte locataire
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facturation" className="mt-0">
            <section id="facturation" className="space-y-3 scroll-mt-24">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    Facturation ({invoices.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Retrouvez et pilotez les pièces de facturation rattachées à ce locataire.
                  </p>
                </div>
                <a href={`/facturation/nouvelle?tenantId=${tenantId}`}>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                    Nouvelle facture
                  </Button>
                </a>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <Input
                  value={invoiceSearch}
                  onChange={(event) => setInvoiceSearch(event.target.value)}
                  placeholder="Rechercher par numéro, type, période ou montant..."
                  className="xl:max-w-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {INVOICE_FILTERS.map((filter) => (
                    <Button
                      key={filter.value}
                      type="button"
                      variant={invoiceFilter === filter.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInvoiceFilter(filter.value)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>

              {billingInvoices.length === 0 ? (
                <div className="rounded-md border border-dashed py-8 text-center">
                  <Receipt className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune pièce de facturation ne correspond aux filtres</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[105px]">Date</TableHead>
                        <TableHead>N° / brouillon</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingInvoices.map((invoice) => {
                        const amount = getInvoiceAmount(invoice);
                        const isValidating = validatingInvoiceId === invoice.id;
                        const isDuplicating = duplicatingInvoiceId === invoice.id;
                        const canGeneratePdf = invoice.status !== "BROUILLON";
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="text-xs tabular-nums whitespace-nowrap">
                              {formatDate(invoice.issueDate)}
                            </TableCell>
                            <TableCell>
                              <a
                                href={`/facturation/${invoice.id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {invoice.invoiceNumber ?? "Brouillon"}
                              </a>
                            </TableCell>
                            <TableCell className="text-xs">
                              {INVOICE_TYPE_LABELS[invoice.invoiceType] ?? invoice.invoiceType}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatPeriod(invoice.periodStart, invoice.periodEnd) || "-"}
                            </TableCell>
                            <TableCell className={`text-right text-xs tabular-nums font-medium ${amount < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                              {formatCurrency(amount)} €
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANTS[invoice.status] ?? "default"} className="text-[10px]">
                                {STATUS_LABELS[invoice.status] ?? invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button asChild variant="ghost" size="icon" title="Ouvrir la facture">
                                  <a href={`/facturation/${invoice.id}`}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">Ouvrir</span>
                                  </a>
                                </Button>
                                {canGeneratePdf && (
                                  <Button asChild variant="ghost" size="icon" title="Télécharger le PDF">
                                    <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                                      <Download className="h-4 w-4" />
                                      <span className="sr-only">PDF</span>
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Dupliquer en brouillon"
                                  onClick={() => handleDuplicateInvoice(invoice.id)}
                                  disabled={isPending}
                                >
                                  {isDuplicating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Dupliquer</span>
                                </Button>
                                {invoice.status === "BROUILLON" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleValidateInvoice(invoice.id)}
                                    disabled={isPending}
                                  >
                                    {isValidating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    Valider
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="compte" className="mt-0">
            <section id="compte-locataire" className="space-y-6 scroll-mt-24">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Situation du compte locataire
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Mouvements facturés, paiements, avoirs et reprises de soldes.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="h-4 w-4" />
                    Relevé CSV
                  </Button>
                  <Dialog open={showLedgerImportDialog} onOpenChange={setShowLedgerImportDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4" />
                        Importer un relevé
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Importer un relevé locataire</DialogTitle>
                        <DialogDescription>
                          Importer un export CSV ou TSV d&apos;un ancien logiciel, sans créer de factures.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Fichier CSV ou TSV</Label>
                          <Input
                            type="file"
                            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleLedgerFile(file);
                            }}
                          />
                        </div>
                        {ledgerFileName && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileSpreadsheet className="h-4 w-4" />
                            {ledgerFileName}
                          </div>
                        )}
                        {ledgerImportErrors.length > 0 && (
                          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                            {ledgerImportErrors.map((error) => (
                              <p key={error}>{error}</p>
                            ))}
                          </div>
                        )}
                        {ledgerImportLines.length > 0 && (
                          <div className="rounded-md border overflow-auto max-h-[260px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Libellé</TableHead>
                                  <TableHead className="text-right">Débit</TableHead>
                                  <TableHead className="text-right">Crédit</TableHead>
                                  <TableHead className="text-right">Solde</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ledgerImportLines.slice(0, 8).map((line, index) => (
                                  <TableRow key={`${line.date}-${index}`}>
                                    <TableCell className="text-xs">{formatDate(line.date)}</TableCell>
                                    <TableCell className="text-xs">{line.label}</TableCell>
                                    <TableCell className="text-right text-xs tabular-nums text-destructive">
                                      {line.debit ? `${formatCurrency(line.debit)} €` : ""}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums text-emerald-600">
                                      {line.credit ? `${formatCurrency(line.credit)} €` : ""}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {typeof line.balanceAfter === "number" ? `${formatCurrency(line.balanceAfter)} €` : ""}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {ledgerImportLines.length > 8 && (
                          <p className="text-xs text-muted-foreground">
                            {ledgerImportLines.length - 8} ligne(s) supplémentaire(s) seront aussi importées.
                          </p>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLedgerImportDialog(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleImportLedgerStatement} disabled={isPending || ledgerImportLines.length === 0}>
                          {isPending ? "Import..." : `Importer ${ledgerImportLines.length} ligne(s)`}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={showDebitDialog} onOpenChange={setShowDebitDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4" />
                        Importer un solde précédent
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Importer un solde précédent</DialogTitle>
                        <DialogDescription>
                          Reprendre un solde existant sans générer de facture ni de numéro.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Libellé</Label>
                          <Input
                            placeholder="Ex: Solde antérieur au démarrage"
                            value={debitForm.label}
                            onChange={(e) => setDebitForm({ ...debitForm, label: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Montant TTC du solde (€)</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={debitForm.amount}
                            onChange={(e) => setDebitForm({ ...debitForm, amount: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Date de reprise</Label>
                          <Input
                            type="date"
                            value={debitForm.dueDate}
                            onChange={(e) => setDebitForm({ ...debitForm, dueDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Notes (optionnel)</Label>
                          <Textarea
                            placeholder="Détail ou contexte..."
                            value={debitForm.notes}
                            onChange={(e) => setDebitForm({ ...debitForm, notes: e.target.value })}
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDebitDialog(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleCreateDebit} disabled={isPending || !debitForm.label || !debitForm.amount}>
                          {isPending ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total facturé</p>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(totalFacture)} €
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total avoirs</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              -{formatCurrency(totalAvoir)} €
            </p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs text-muted-foreground">Total paiements</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              -{formatCurrency(totalPaiements)} €
            </p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${balance > 0 ? "border-destructive/30 bg-destructive/5" : balance < 0 ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
            <p className="text-xs text-muted-foreground">Solde dû</p>
            <p className={`text-lg font-bold tabular-nums ${balance > 0 ? "text-destructive" : balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
              {balance > 0 ? "+" : ""}{formatCurrency(balance)} €
            </p>
          </div>
        </div>

        {/* Tableau des mouvements */}
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun mouvement pour ce locataire</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right w-[100px]">Débit</TableHead>
                  <TableHead className="text-right w-[100px]">Crédit</TableHead>
                  <TableHead className="text-right w-[120px]">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m, i) => (
                  <TableRow key={i} className={m.status === "ANNULEE" ? "opacity-40 line-through" : ""}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {formatDate(m.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {m.type === "debit" ? (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className="text-xs">{m.label}</span>
                        {m.invoiceNumber && (
                          <a
                            href={`/facturation/${m.invoiceId}`}
                            className="text-[10px] text-muted-foreground hover:underline shrink-0"
                          >
                            {m.invoiceNumber}
                          </a>
                        )}
                        {m.status && (
                          <Badge variant={STATUS_VARIANTS[m.status] ?? "default"} className="text-[10px] shrink-0">
                            {STATUS_LABELS[m.status] ?? m.status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-destructive font-medium">
                      {m.type === "debit" ? `${formatCurrency(m.amount)} €` : ""}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      {m.type === "credit" ? `${formatCurrency(m.amount)} €` : ""}
                    </TableCell>
                    <TableCell className={`text-right text-xs tabular-nums font-semibold ${m.balance > 0 ? "text-destructive" : m.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                      {m.balance > 0 ? "+" : ""}{formatCurrency(m.balance)} €
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
            </section>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
