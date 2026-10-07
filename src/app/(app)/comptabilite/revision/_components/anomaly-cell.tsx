"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

import { getAccountAnomalies } from "@/actions/account-review";
import type { AccountAnomaly, AccountAnomalySeverity } from "@/lib/account-anomalies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AnomalyCellProps = {
  societyId: string;
  accountId: string;
  accountCode: string;
  accountLabel: string;
  fiscalYearId: string;
  initialCount: number;
};

const SEVERITY_BADGES: Record<AccountAnomalySeverity, "default" | "secondary" | "outline" | "destructive"> = {
  CRITICAL: "destructive",
  HIGH: "destructive",
  MEDIUM: "outline",
  LOW: "secondary",
};

const SEVERITY_LABELS: Record<AccountAnomalySeverity, string> = {
  CRITICAL: "Critique",
  HIGH: "Important",
  MEDIUM: "À vérifier",
  LOW: "Information",
};

function buildFixLink(
  anomaly: AccountAnomaly,
  accountId: string
): { href: string; label: string } | null {
  switch (anomaly.type) {
    case "UNLETTERED_LINES":
      return { href: `/comptabilite/lettrage?accountId=${accountId}`, label: "Ouvrir le lettrage" };
    case "BALANCE_MISMATCH":
    case "WRONG_SENS":
    case "DUPLICATE_PIECES":
    case "NEGATIVE_AMOUNTS":
      return { href: `/comptabilite?accountId=${accountId}`, label: "Voir le grand livre" };
    default:
      return null;
  }
}

export function AnomalyCell({
  societyId,
  accountId,
  accountCode,
  accountLabel,
  fiscalYearId,
  initialCount,
}: AnomalyCellProps) {
  const [open, setOpen] = useState(false);
  const [anomalies, setAnomalies] = useState<AccountAnomaly[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadDetails() {
    startTransition(async () => {
      const result = await getAccountAnomalies(societyId, accountId, fiscalYearId);
      if (result.success && result.data) {
        setAnomalies(result.data.anomalies);
      } else {
        toast.error(result.error ?? "Impossible de charger les anomalies");
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && anomalies === null) loadDetails();
  }

  if (initialCount === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <span>Aucune</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 shadow-sm transition hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
          aria-label={`${initialCount} anomalie${initialCount > 1 ? "s" : ""} détectée${initialCount > 1 ? "s" : ""}`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {initialCount} anomalie{initialCount > 1 ? "s" : ""}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            Anomalies — {accountCode} {accountLabel}
          </DialogTitle>
          <DialogDescription>
            Résultat de la détection automatique sur l&apos;exercice sélectionné.
          </DialogDescription>
        </DialogHeader>

        {isPending && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse du compte en cours…
          </div>
        )}

        {!isPending && anomalies && anomalies.length === 0 && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Aucune anomalie détectée actuellement sur ce compte.
          </div>
        )}

        {!isPending && anomalies && anomalies.length > 0 && (
          <div className="space-y-3 pt-2">
            {anomalies.map((anomaly, index) => {
              const fix = buildFixLink(anomaly, accountId);
              return (
                <div
                  key={`${anomaly.type}-${index}`}
                  className="rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Badge variant={SEVERITY_BADGES[anomaly.severity]}>
                        {SEVERITY_LABELS[anomaly.severity]}
                      </Badge>
                      <p className="text-sm font-medium leading-snug">{anomaly.message}</p>
                      {anomaly.fix && (
                        <p className="text-xs text-muted-foreground">{anomaly.fix}</p>
                      )}
                    </div>
                    {fix && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={fix.href} onClick={() => setOpen(false)}>
                          {fix.label}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={loadDetails} disabled={isPending}>
                Rafraîchir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
