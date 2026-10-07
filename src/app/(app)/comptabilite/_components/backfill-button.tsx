"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Wrench } from "lucide-react";

import {
  backfillMissingAvoirJournalEntries,
  backfillMissingQuittanceJournalEntries,
  type BackfillResult,
} from "@/actions/accounting-backfill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BackfillKind = "avoir" | "quittance";

export function BackfillAdminTools({ societyId }: { societyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<BackfillKind | null>(null);
  const [lastResult, setLastResult] = useState<
    { kind: BackfillKind; data: BackfillResult } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function runBackfill(kind: BackfillKind) {
    setPendingKind(kind);
    startTransition(async () => {
      const result =
        kind === "avoir"
          ? await backfillMissingAvoirJournalEntries(societyId)
          : await backfillMissingQuittanceJournalEntries(societyId);

      setPendingKind(null);

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Erreur lors du rattrapage");
        return;
      }

      setLastResult({ kind, data: result.data });
      const label = kind === "avoir" ? "avoir(s)" : "quittance(s)";
      toast.success(
        `${result.data.succeeded}/${result.data.processed} ${label} rattrapé(s)`
      );
      router.refresh();
    });
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Outils admin
          </CardTitle>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Rattrapage des écritures comptables manquantes pour les factures
            historiques. Les actions sont idempotentes : une facture déjà rattachée
            à une écriture est ignorée.
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runBackfill("avoir")}
              disabled={isPending}
            >
              {isPending && pendingKind === "avoir" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wrench className="h-3 w-3" />
              )}
              Rattrapage données — Avoirs
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => runBackfill("quittance")}
              disabled={isPending}
            >
              {isPending && pendingKind === "quittance" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wrench className="h-3 w-3" />
              )}
              Rattrapage données — Quittances
            </Button>
          </div>

          {lastResult && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="font-medium">
                Dernier rattrapage :{" "}
                {lastResult.kind === "avoir" ? "avoirs" : "quittances"}
              </div>
              <div className="text-muted-foreground">
                {lastResult.data.processed} facture(s) analysée(s) ·{" "}
                {lastResult.data.succeeded} écriture(s) créée(s) ·{" "}
                {lastResult.data.failed} échec(s)
              </div>
              {lastResult.data.errors.length > 0 && (
                <ul className="mt-2 max-h-32 list-disc overflow-auto pl-4 text-destructive">
                  {lastResult.data.errors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {lastResult.data.errors.length > 10 && (
                    <li>…et {lastResult.data.errors.length - 10} autre(s)</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
