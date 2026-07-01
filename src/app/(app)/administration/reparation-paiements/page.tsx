import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { detectOverAllocatedTransactions } from "@/actions/bank-repair";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RepairButton } from "./_components/repair-button";

export const metadata = { title: "Réparation paiements" };
export const dynamic = "force-dynamic";

export default async function ReparationPaiementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const result = await detectOverAllocatedTransactions(societyId);
  const anomalies = result.success ? result.data ?? [] : [];
  const totalOverage = anomalies.reduce((s, a) => s + a.overage, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Réparation des paiements sur-affectés
        </h1>
        <p className="text-muted-foreground">
          Détecte les virements dont la somme des allocations aux factures
          dépasse le montant réellement reçu (héritage d&apos;anciens
          rapprochements avant le fix de plafonnement).
        </p>
      </div>

      {!result.success && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="py-4 text-sm text-red-700">
            {result.error}
          </CardContent>
        </Card>
      )}

      {result.success && anomalies.length === 0 && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Aucune anomalie détectée
              </p>
              <p className="text-xs text-emerald-700">
                Toutes les transactions rapprochées sur cette société
                respectent l&apos;égalité{" "}
                <code>Σ allocations = montant du virement</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {anomalies.length > 0 && (
        <>
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-amber-900">
                  {anomalies.length} virement
                  {anomalies.length > 1 ? "s" : ""} sur-affecté
                  {anomalies.length > 1 ? "s" : ""} — surplus artificiel{" "}
                  {formatCurrency(totalOverage)}
                </p>
                <p className="text-xs text-amber-800">
                  Chaque ligne montre le virement, le total actuellement
                  alloué (supérieur au montant reçu) et la répartition
                  proposée après scaling proportionnel. « Corriger »
                  ajuste <code>BankReconciliation.amount</code> et{" "}
                  <code>Payment.amount</code> puis recalcule le statut des
                  factures concernées.
                </p>
              </div>
            </CardContent>
          </Card>

          {anomalies.map((a) => (
            <Card key={a.transactionId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-tight">
                      {a.transactionLabel}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(a.transactionDate)}
                      {a.transactionReference ? ` · Réf: ${a.transactionReference}` : ""}
                    </CardDescription>
                  </div>
                  <RepairButton
                    societyId={societyId}
                    transactionId={a.transactionId}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Reçu en banque</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(a.transactionAmount)}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Alloué (actuel)</p>
                    <p className="text-lg font-semibold tabular-nums text-red-600">
                      {formatCurrency(a.totalAllocated)}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Surplus fictif</p>
                    <p className="text-lg font-semibold tabular-nums text-amber-600">
                      +{formatCurrency(a.overage)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Locataire / Facture</th>
                        <th className="pb-2 text-right font-medium">Total facture</th>
                        <th className="pb-2 text-right font-medium">Alloué actuel</th>
                        <th className="pb-2 text-right font-medium">Alloué après correction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {a.allocations.map((alloc) => (
                        <tr key={alloc.reconciliationId}>
                          <td className="py-2">
                            <p className="font-medium leading-tight">{alloc.tenantLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {alloc.invoiceNumber ?? "—"}
                            </p>
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(alloc.invoiceTotalTTC)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-red-600 font-medium">
                            {formatCurrency(alloc.currentAmount)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-emerald-600 font-semibold">
                            {formatCurrency(alloc.proposedAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
