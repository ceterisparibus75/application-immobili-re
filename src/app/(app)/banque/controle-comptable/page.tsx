import { getBankOperationsDashboard } from "@/actions/bank-dashboard";
import { GenerateMissingBqueButton } from "@/app/(app)/banque/_components/generate-missing-bque-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, GitMerge } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Contrôle comptable banque" };

const SEVERITY_VARIANTS = {
  info: "secondary",
  warning: "warning",
  critical: "destructive",
} as const;

export default async function BankAccountingControlPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const dashboard = await getBankOperationsDashboard(societyId);
  if (!dashboard) redirect("/societes");
  const missingJournalEntriesCount = dashboard.accountRows.reduce(
    (sum, account) => sum + account.missingJournalEntryCount,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/banque">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contrôle comptable banque</h1>
            <p className="text-muted-foreground">Écarts banque/512, écritures BQUE manquantes et rapprochements à finaliser.</p>
          </div>
        </div>
        <Link href="/comptabilite">
          <Button variant="outline" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Ouvrir la comptabilité
          </Button>
        </Link>
        <GenerateMissingBqueButton
          societyId={societyId}
          missingCount={missingJournalEntriesCount}
          variant="default"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-card shadow-brand">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Solde bancaire</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(dashboard.kpis.totalBalance)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card shadow-brand">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Solde comptable 512</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(dashboard.accountingControl.accountingBankBalance)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card shadow-brand">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Écart à investiguer</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${Math.abs(dashboard.accountingControl.bankToAccountingDelta) > 0.01 ? "text-[var(--color-status-negative)]" : "text-[var(--color-status-positive)]"}`}>
              {formatCurrency(dashboard.accountingControl.bankToAccountingDelta)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card shadow-brand">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Écritures BQUE</p>
            <p className="mt-1 text-xl font-bold">{dashboard.accountingControl.bankJournalEntriesCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-card shadow-brand">
        <CardHeader>
          <CardTitle className="text-base">Anomalies actionnables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.accountingControl.anomalies.map((anomaly) => (
            <div key={anomaly.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-4">
              <div className="flex items-center gap-3">
                {anomaly.severity === "critical" ? (
                  <AlertTriangle className="h-5 w-5 text-[var(--color-status-negative)]" />
                ) : (
                  <GitMerge className="h-5 w-5 text-[var(--color-status-caution)]" />
                )}
                <div>
                  <p className="font-medium">{anomaly.label}</p>
                  <p className="text-xs text-muted-foreground">Code contrôle : {anomaly.code}</p>
                </div>
              </div>
              <Badge variant={SEVERITY_VARIANTS[anomaly.severity]}>{anomaly.count}</Badge>
            </div>
          ))}
          {dashboard.accountingControl.anomalies.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 p-4 text-[var(--color-status-positive)]">
              <CheckCircle2 className="h-5 w-5" />
              Aucun écart détecté sur la période de pilotage.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-card shadow-brand">
        <CardHeader>
          <CardTitle className="text-base">Contrôle par compte</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="text-right">Non rapprochées</TableHead>
                <TableHead className="text-right">BQUE manquantes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.accountRows.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <Link href={`/banque/${account.id}`} className="font-medium hover:underline">
                      {account.accountName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{account.bankName}</p>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(account.currentBalance)}</TableCell>
                  <TableCell className="text-right">{account.unreconciledCount}</TableCell>
                  <TableCell className="text-right">{account.missingJournalEntryCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <GenerateMissingBqueButton
                        societyId={societyId}
                        bankAccountId={account.id}
                        missingCount={account.missingJournalEntryCount}
                        size="sm"
                        variant="ghost"
                      />
                      <Link href={`/banque/${account.id}/rapprochement`}>
                        <Button variant="ghost" size="sm">Traiter</Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
