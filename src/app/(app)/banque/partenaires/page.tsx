import { getBankOperationsDashboard } from "@/actions/bank-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Partenaires bancaires" };

const PROVIDER_LABELS: Record<string, string> = {
  POWENS: "Powens",
  QONTO: "Qonto",
  MANUAL: "Manuel",
  OTHER: "Autre",
};

function statusBadgeVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  if (status === "active" || status === "manual") return "success";
  if (status === "pending") return "warning";
  if (status === "error" || status === "expired") return "destructive";
  return "secondary";
}

export default async function BankPartnersPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const dashboard = await getBankOperationsDashboard(societyId);
  if (!dashboard) redirect("/societes");

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
            <h1 className="text-2xl font-semibold tracking-tight">Partenaires bancaires</h1>
            <p className="text-muted-foreground">Suivi des connecteurs, comptes rattachés, volumes et qualité de flux.</p>
          </div>
        </div>
        <Link href="/banque/connexion">
          <Button className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Connecter une banque
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {dashboard.partnerFlows.map((partner) => (
          <Card key={partner.key} className="border-0 bg-card shadow-brand">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{partner.institutionName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{PROVIDER_LABELS[partner.provider]}</p>
                </div>
                <Badge variant={statusBadgeVariant(partner.status)}>
                  {partner.status === "manual" ? "manuel" : partner.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Comptes</p>
                  <p className="font-semibold">{partner.accountCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="font-semibold">{partner.transactionCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Solde</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(partner.totalBalance)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Non rapprochées</p>
                  <p className="font-semibold text-[var(--color-status-caution)]">{partner.unreconciledCount}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Fournisseurs à payer</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(partner.supplierToPayAmount)}</p>
                  <p className="text-xs text-muted-foreground">{partner.supplierToPayCount} facture{partner.supplierToPayCount !== 1 ? "s" : ""}</p>
                </div>
                {partner.supplierOverdueCount > 0 && (
                  <div className="rounded-lg bg-[var(--color-status-negative-bg)]/60 p-3">
                    <p className="text-xs text-[var(--color-status-negative)]">Retards fournisseurs</p>
                    <p className="font-semibold tabular-nums text-[var(--color-status-negative)]">{formatCurrency(partner.supplierOverdueAmount)}</p>
                    <p className="text-xs text-muted-foreground">{partner.supplierOverdueCount} échéance{partner.supplierOverdueCount !== 1 ? "s" : ""}</p>
                  </div>
                )}
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">À rapprocher</p>
                  <p className="font-semibold tabular-nums text-[var(--color-status-caution)]">{formatCurrency(partner.supplierToReconcileAmount)}</p>
                  <p className="text-xs text-muted-foreground">{partner.supplierToReconcileCount} paiement{partner.supplierToReconcileCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {partner.lastSyncAt ? `Dernière synchronisation : ${formatDate(partner.lastSyncAt)}` : "Aucune synchronisation automatique connue"}
                {partner.expiresAt && ` · Expire le ${formatDate(partner.expiresAt)}`}
              </div>
              {partner.status !== "active" && partner.provider !== "MANUAL" && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-status-negative)]/30 bg-[var(--color-status-negative-bg)]/50 p-3 text-sm text-[var(--color-status-negative)]">
                  <ShieldAlert className="h-4 w-4" />
                  Connexion à vérifier avant la prochaine synchronisation.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 bg-card shadow-brand">
        <CardHeader>
          <CardTitle className="text-base">Comptes par partenaire</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead>Partenaire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Transactions période</TableHead>
                <TableHead className="text-right">BQUE manquantes</TableHead>
                <TableHead className="text-right">Solde</TableHead>
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
                  <TableCell>{PROVIDER_LABELS[account.provider]}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(account.status)}>{account.status === "manual" ? "manuel" : account.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{account.transactionCount}</TableCell>
                  <TableCell className="text-right">{account.missingJournalEntryCount}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(account.currentBalance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
