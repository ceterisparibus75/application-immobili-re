import { getBankOperationsDashboard, type BankAccountingAnomaly } from "@/actions/bank-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  GitMerge,
  Landmark,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SyncAllButton from "./_components/sync-all-button";

export const metadata = { title: "Banque" };

const PROVIDER_LABELS: Record<string, string> = {
  POWENS: "Powens",
  QONTO: "Qonto",
  MANUAL: "Manuel",
  OTHER: "Autre",
};

const ANOMALY_VARIANTS: Record<BankAccountingAnomaly["severity"], "secondary" | "warning" | "destructive"> = {
  info: "secondary",
  warning: "warning",
  critical: "destructive",
};

function statusBadgeVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  if (status === "active" || status === "manual") return "success";
  if (status === "pending") return "warning";
  if (status === "error" || status === "expired") return "destructive";
  return "secondary";
}

function formatSignedCurrency(value: number): string {
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
}

export default async function BanquePage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");

  if (!societyId) redirect("/societes");

  const dashboard = await getBankOperationsDashboard(societyId);
  if (!dashboard) redirect("/societes");

  const hasAccounts = dashboard.accountRows.length > 0;
  const totalActions =
    dashboard.actionQueues.unreconciledTransactions +
    dashboard.actionQueues.uncategorizedTransactions +
    dashboard.actionQueues.missingBankJournalEntries +
    dashboard.actionQueues.supplierInvoicesToPay +
    dashboard.actionQueues.supplierPaymentsToReconcile +
    dashboard.actionQueues.bankingConnectionsAttention;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pilotage banque</h1>
          <p className="text-muted-foreground">
            Flux, rapprochement comptable, partenaires bancaires et paiements fournisseurs sur les 30 derniers jours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/cashflow">
            <Button variant="outline" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Cash-flow
            </Button>
          </Link>
          <Link href="/banque/factures-fournisseurs">
            <Button variant="outline" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              Fournisseurs
            </Button>
          </Link>
          <Link href="/banque/controle-comptable">
            <Button variant="outline" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Contrôle
            </Button>
          </Link>
          {hasAccounts && <SyncAllButton societyId={societyId} />}
          <Link href="/banque/nouveau-compte">
            <Button className="bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg gap-1.5">
              <Plus className="h-4 w-4" />
              Nouveau compte
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl bg-card p-5 shadow-brand">
          <p className="text-xs text-muted-foreground">Solde bancaire</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(dashboard.kpis.totalBalance)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{dashboard.accountingControl.bankAccountCount} compte{dashboard.accountingControl.bankAccountCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-brand">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-[var(--color-status-positive)]" />
            <p className="text-xs text-muted-foreground">Entrées période</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-status-positive)]">
            {formatSignedCurrency(dashboard.kpis.periodCredits)}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-brand">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-[var(--color-status-negative)]" />
            <p className="text-xs text-muted-foreground">Sorties période</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-status-negative)]">
            {formatCurrency(dashboard.kpis.periodDebits)}
          </p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-brand">
          <p className="text-xs text-muted-foreground">Flux net</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${dashboard.kpis.periodNet >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
            {formatSignedCurrency(dashboard.kpis.periodNet)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{dashboard.kpis.transactionCount} opération{dashboard.kpis.transactionCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-brand">
          <p className="text-xs text-muted-foreground">À traiter</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${totalActions > 0 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-positive)]"}`}>
            {totalActions}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{dashboard.kpis.reconciliationRate}% rapproché</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-6">
        <Link href={hasAccounts ? `/banque/${dashboard.accountRows[0]?.id}/rapprochement` : "/banque/nouveau-compte"}>
          <Card className="h-full border-0 bg-card shadow-brand transition-shadow hover:shadow-brand-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Transactions à rapprocher</p>
                <p className="text-2xl font-bold text-[var(--color-status-caution)]">{dashboard.actionQueues.unreconciledTransactions}</p>
              </div>
              <GitMerge className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/cashflow">
          <Card className="h-full border-0 bg-card shadow-brand transition-shadow hover:shadow-brand-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">À catégoriser</p>
                <p className="text-2xl font-bold">{dashboard.actionQueues.uncategorizedTransactions}</p>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/comptabilite">
          <Card className="h-full border-0 bg-card shadow-brand transition-shadow hover:shadow-brand-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">BQUE manquantes</p>
                <p className="text-2xl font-bold">{dashboard.actionQueues.missingBankJournalEntries}</p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/banque/factures-fournisseurs?status=VALIDATED">
          <Card className="h-full border-0 bg-card shadow-brand transition-shadow hover:shadow-brand-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Fournisseurs à payer</p>
                <p className="text-2xl font-bold">{dashboard.actionQueues.supplierInvoicesToPay}</p>
              </div>
              <WalletCards className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href={hasAccounts ? `/banque/${dashboard.accountRows[0]?.id}/rapprochement` : "/banque/factures-fournisseurs"}>
          <Card className="h-full border-0 bg-card shadow-brand transition-shadow hover:shadow-brand-lg">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Fournisseurs à rapprocher</p>
                <p className="text-2xl font-bold">{dashboard.actionQueues.supplierPaymentsToReconcile}</p>
              </div>
              <Link2 className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Card className="h-full border-0 bg-card shadow-brand">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">Connexions à vérifier</p>
              <p className="text-2xl font-bold">{dashboard.actionQueues.bankingConnectionsAttention}</p>
            </div>
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Partenaires bancaires</h2>
          <Link href="/banque/partenaires">
            <Button variant="outline" size="sm" className="gap-1.5">
              Vue détaillée
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {dashboard.partnerFlows.map((partner) => (
            <Card key={partner.key} className="border-0 bg-card shadow-brand">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{partner.institutionName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{PROVIDER_LABELS[partner.provider]}</p>
                  </div>
                  <Badge variant={statusBadgeVariant(partner.status)}>{partner.status === "manual" ? "manuel" : partner.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Solde</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(partner.totalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Flux net</p>
                    <p className={`font-semibold tabular-nums ${partner.periodNet >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                      {formatSignedCurrency(partner.periodNet)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="font-semibold">{partner.transactionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Non rapprochées</p>
                    <p className="font-semibold text-[var(--color-status-caution)]">{partner.unreconciledCount}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {partner.lastSyncAt ? `Dernière sync : ${formatDate(partner.lastSyncAt)}` : "Synchronisation manuelle ou non initialisée"}
                </p>
              </CardContent>
            </Card>
          ))}
          {dashboard.partnerFlows.length === 0 && (
            <Card className="border-0 bg-card shadow-brand lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Landmark className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Aucun partenaire bancaire connecté</p>
                <p className="mt-1 text-sm text-muted-foreground">Ajoutez un compte manuel ou connectez un partenaire bancaire pour démarrer le pilotage.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="border-0 bg-card shadow-brand xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comptes et flux</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="text-right">Entrées</TableHead>
                  <TableHead className="text-right">Sorties</TableHead>
                  <TableHead className="text-right">À rapprocher</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.accountRows.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <Link href={`/banque/${account.id}`} className="font-medium hover:underline">
                          {account.accountName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{account.bankName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(account.status)}>{PROVIDER_LABELS[account.provider]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(account.currentBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums text-[var(--color-status-positive)]">{formatSignedCurrency(account.periodCredits)}</TableCell>
                    <TableCell className="text-right tabular-nums text-[var(--color-status-negative)]">{formatCurrency(account.periodDebits)}</TableCell>
                    <TableCell className="text-right">
                      <span className={account.unreconciledCount > 0 ? "font-semibold text-[var(--color-status-caution)]" : "text-muted-foreground"}>
                        {account.unreconciledCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/banque/${account.id}/rapprochement`}>
                        <Button variant="ghost" size="sm">Rapprocher</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {dashboard.accountRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Aucun compte bancaire. Ajoutez un compte pour activer le cockpit.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card shadow-brand">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Contrôle comptable</span>
              <Link href="/banque/controle-comptable" className="text-xs font-normal text-muted-foreground hover:text-foreground">
                Détail
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Solde 512</p>
                <p className="font-semibold tabular-nums">{formatCurrency(dashboard.accountingControl.accountingBankBalance)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Écart</p>
                <p className={`font-semibold tabular-nums ${Math.abs(dashboard.accountingControl.bankToAccountingDelta) > 0.01 ? "text-[var(--color-status-negative)]" : "text-[var(--color-status-positive)]"}`}>
                  {formatCurrency(dashboard.accountingControl.bankToAccountingDelta)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {dashboard.accountingControl.anomalies.map((anomaly) => (
                <div key={anomaly.code} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                  <div className="flex items-center gap-2">
                    {anomaly.severity === "critical" ? (
                      <AlertTriangle className="h-4 w-4 text-[var(--color-status-negative)]" />
                    ) : (
                      <Clock className="h-4 w-4 text-[var(--color-status-caution)]" />
                    )}
                    <p className="text-sm">{anomaly.label}</p>
                  </div>
                  <Badge variant={ANOMALY_VARIANTS[anomaly.severity]}>{anomaly.count}</Badge>
                </div>
              ))}
              {dashboard.accountingControl.anomalies.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-[var(--color-status-positive)]">
                  <ShieldCheck className="h-4 w-4" />
                  Aucun écart opérationnel détecté sur la période.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Paiements fournisseurs</h2>
          <Link href="/banque/factures-fournisseurs">
            <Button variant="outline" size="sm" className="gap-1.5">
              Registre fournisseurs
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <Card className="border-0 bg-card shadow-brand">
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {dashboard.supplierPayments.slice(0, 8).map((invoice) => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <Link href={`/banque/factures-fournisseurs/${invoice.id}`} className="font-medium hover:underline">
                      {invoice.supplierName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {invoice.dueDate ? `Échéance ${formatDate(invoice.dueDate)}` : "Échéance non renseignée"}
                      {invoice.paymentMethod && ` · ${invoice.paymentMethod}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{formatCurrency(invoice.amountTTC)}</span>
                    {invoice.needsPayment && <Badge variant="warning">À payer</Badge>}
                    {invoice.needsBankReconciliation && <Badge variant="warning">À rapprocher</Badge>}
                    {!invoice.needsPayment && !invoice.needsBankReconciliation && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Traité
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {dashboard.supplierPayments.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aucun paiement fournisseur à traiter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
