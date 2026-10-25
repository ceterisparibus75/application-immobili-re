import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { listOverpaymentAdjustments } from "@/actions/overpayment-cleanup";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CleanupGroupCard } from "./_components/cleanup-group-card";

export const metadata = { title: "Nettoyage « trop-perçu sur virement »" };

export default async function TropPercuCleanupPage() {
  const result = await listOverpaymentAdjustments();
  const groups = result.success && result.data ? result.data : [];
  const totalRows = groups.reduce((s, g) => s + g.count, 0);
  const totalCredit = groups.reduce((s, g) => s + g.totalCredited, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/administration">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <AlertTriangle className="h-6 w-6 text-[var(--color-status-caution)]" />
            Nettoyage « Avoir — trop-perçu sur virement »
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reprises de solde créées à tort par l&apos;ancien rapprochement bancaire :
            elles doublaient le crédit sur la fiche locataire (le virement
            apparaissait déjà en intégralité en crédit). Depuis le correctif,
            aucune nouvelle reprise de ce type n&apos;est créée — reste à purger
            l&apos;historique pour que les soldes affichés redeviennent justes.
          </p>
        </div>
      </div>

      {!result.success && (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">
            Erreur : {result.error}
          </CardContent>
        </Card>
      )}

      {result.success && groups.length === 0 && (
        <Card className="border-[var(--color-status-positive)]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-[var(--color-status-positive)]" />
              Rien à nettoyer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aucun ajustement « trop-perçu sur virement » n&apos;est présent sur
            les sociétés accessibles.
          </CardContent>
        </Card>
      )}

      {groups.length > 0 && (
        <>
          <Card>
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-semibold">{totalRows}</span>{" "}
                enregistrement{totalRows > 1 ? "s" : ""} fantôme{totalRows > 1 ? "s" : ""}{" "}
                sur <span className="font-semibold">{groups.length}</span>{" "}
                société{groups.length > 1 ? "s" : ""} — crédit total à retirer :{" "}
                <span className="font-semibold">{formatCurrency(totalCredit)}</span>
              </div>
            </CardContent>
          </Card>

          {groups.map((g) => (
            <CleanupGroupCard
              key={g.societyId}
              societyId={g.societyId}
              societyName={g.societyName}
              count={g.count}
              totalCredited={g.totalCredited}
              adjustments={g.adjustments.map((a) => ({
                id: a.id,
                tenantId: a.tenantId,
                tenantName: a.tenantName,
                amount: a.amount,
                dueDate: a.dueDate.toISOString(),
                formattedDueDate: formatDate(a.dueDate),
                notes: a.notes,
                reference: a.reference,
              }))}
            />
          ))}
        </>
      )}
    </div>
  );
}
