"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  SkipForward,
  ArrowRight,
} from "lucide-react";
import { syncAllAccounts } from "@/actions/bank-connection";
import type { SyncAllResult, SyncAccountDetail } from "@/actions/bank-connection";
import { toast } from "sonner";

function StatusIcon({ status }: { status: SyncAccountDetail["status"] }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-[var(--color-status-positive)]" />;
    case "error":
      return <XCircle className="h-4 w-4 text-[var(--color-status-negative)]" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-gray-400" />;
  }
}

function statusLabel(status: SyncAccountDetail["status"]): string {
  switch (status) {
    case "ok": return "Synchronisé";
    case "error": return "Erreur";
    case "skipped": return "Ignoré";
  }
}

export default function SyncAllButton({ societyId }: { societyId: string }) {
  const [syncing, startSync] = useTransition();
  const [result, setResult] = useState<SyncAllResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleSync() {
    startSync(async () => {
      const res = await syncAllAccounts(societyId);
      if (res.success && res.data) {
        setResult(res.data);
        setDialogOpen(true);

        // Toast rapide
        if (res.data.accountsFailed > 0) {
          toast.warning("Synchronisation terminée avec des erreurs", {
            description: `${res.data.accountsSynced} compte(s) OK, ${res.data.accountsFailed} en erreur`,
          });
        } else if (res.data.totalImported === 0) {
          toast.success("Tous les comptes sont à jour");
        } else {
          toast.success(
            `${res.data.totalImported} transaction(s) importée(s)`,
            { description: `${res.data.accountsSynced} compte(s) synchronisé(s)` }
          );
        }

        // Warning de cohérence des dates
        if (res.data.dateWarning) {
          setTimeout(() => {
            toast.warning("Incohérence de dates détectée", {
              description: res.data!.dateWarning!,
              duration: 12000,
            });
          }, 800);
        }
      } else {
        toast.error(res.error ?? "Erreur lors de la synchronisation");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleSync}
        disabled={syncing}
        className="gap-1.5"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Synchronisation..." : "Tout synchroniser"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-brand-deep)]">
              Résultat de la synchronisation
            </DialogTitle>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Résumé global */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-[var(--color-status-positive-bg)] p-3">
                  <p className="text-xl font-bold tabular-nums text-[var(--color-status-positive)]">
                    {result.totalImported}
                  </p>
                  <p className="text-xs text-muted-foreground">Transaction(s)</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xl font-bold tabular-nums text-[var(--color-brand-deep)]">
                    {result.accountsSynced}
                  </p>
                  <p className="text-xs text-muted-foreground">Compte(s) OK</p>
                </div>
                {result.accountsFailed > 0 && (
                  <div className="rounded-lg bg-[var(--color-status-negative-bg)] p-3">
                    <p className="text-xl font-bold tabular-nums text-[var(--color-status-negative)]">
                      {result.accountsFailed}
                    </p>
                    <p className="text-xs text-muted-foreground">En erreur</p>
                  </div>
                )}
              </div>

              {/* Warning cohérence dates */}
              {result.dateWarning && (
                <div className="flex gap-2 rounded-lg bg-[var(--color-status-caution-bg)] p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-status-caution)]" />
                  <p className="text-sm text-[var(--color-status-caution)]">
                    {result.dateWarning}
                  </p>
                </div>
              )}

              {/* Détail par compte */}
              <div className="divide-y divide-gray-100 rounded-lg border border-border/60">
                {result.details.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <StatusIcon status={d.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-[var(--color-brand-deep)]">
                        {d.accountName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-muted-foreground">
                          {d.provider}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {statusLabel(d.status)}
                        </span>
                        {d.status === "ok" && d.imported > 0 && (
                          <span className="text-xs font-medium text-[var(--color-status-positive)]">
                            +{d.imported}
                          </span>
                        )}
                      </div>
                      {d.error && (
                        <p className="text-xs text-[var(--color-status-negative)] mt-0.5">{d.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                {result.totalImported > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setDialogOpen(false);
                      window.location.assign("/comptabilite/cashflow");
                    }}
                  >
                    Voir le Cash-flow
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" onClick={() => setDialogOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
