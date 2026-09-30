import { AlertOctagon, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RenewConsentButton } from "./renew-consent-button";
import type { BankSyncHealthAlert } from "@/lib/bank-sync-health";

const KIND_LABELS: Record<BankSyncHealthAlert["kind"], string> = {
  expired: "Expiré",
  expiring: "Bientôt expiré",
  stale: "Sync silencieuse",
  error: "Erreur",
};

/**
 * Bandeau visible en tête de /banque qui liste les comptes dont la sync est
 * en défaut (consentement expiré/expirant, erreur, ou aucune tentative récente).
 * Renouveler le consentement se fait en un clic quand la connexion Powens
 * est encore identifiée.
 */
export function SyncHealthBanner({ alerts }: { alerts: BankSyncHealthAlert[] }) {
  if (alerts.length === 0) return null;

  const hasDanger = alerts.some((a) => a.severity === "danger");
  const toneClass = hasDanger
    ? "border-[var(--color-status-negative)]/30 bg-[var(--color-status-negative-bg)]/40"
    : "border-[var(--color-status-caution)]/30 bg-[var(--color-status-caution-bg)]/40";
  const Icon = hasDanger ? AlertOctagon : AlertTriangle;
  const iconClass = hasDanger
    ? "text-[var(--color-status-negative)]"
    : "text-[var(--color-status-caution)]";

  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold">
                Synchronisation bancaire — {alerts.length} action{alerts.length > 1 ? "s" : ""} requise{alerts.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Un consentement PSD2 expire tous les 90 jours. Sans renouvellement, les nouvelles opérations n&apos;arrivent plus.
              </p>
            </div>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.bankAccountId}
                  className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alert.severity === "danger" ? "destructive" : "warning"}>
                        {KIND_LABELS[alert.kind]}
                      </Badge>
                      <span className="text-sm font-medium">
                        {alert.bankName} — {alert.accountName}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {alert.provider}
                      </Badge>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    {alert.detail && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.detail}</p>
                    )}
                  </div>
                  {alert.connectionId && alert.provider === "POWENS" && (
                    <RenewConsentButton
                      connectionId={alert.connectionId}
                      variant={alert.severity === "danger" ? "default" : "outline"}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
