"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Loader2 } from "lucide-react";
import { toggleDailyDigest } from "@/actions/user-preferences";

interface Props {
  initialEnabled: boolean;
  lastSentAt: string | null;
}

export function DailyDigestCard({ initialEnabled, lastSentAt }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [lastSent, setLastSent] = useState(lastSentAt);
  const [isPending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleDailyDigest(next);
      if (res.success && res.data) {
        setLastSent(res.data.dailyDigestLastSentAt);
        toast.success(next ? "Digest quotidien activé" : "Digest quotidien désactivé");
      } else {
        setEnabled(!next);
        toast.error(res.error ?? "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-blue)]/10">
              <Bell className="h-4 w-4 text-[var(--color-brand-blue)]" />
            </div>
            <div>
              <CardTitle>Digest quotidien</CardTitle>
              <CardDescription className="mt-1">
                Un email récap chaque matin (7 h 30 UTC) avec vos actions à traiter sur toutes vos sociétés.
                Silencieux quand rien à signaler.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Switch
              id="daily-digest-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-label="Activer le digest quotidien"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
          <p>
            <strong className="text-foreground">Contenu du digest :</strong> brouillons à valider · factures impayées ·
            révisions de loyer en attente · baux à échéance sous 30 j · documents expirant · emails en échec.
          </p>
          <p>
            Quand activé, les notifications individuelles &laquo;&nbsp;brouillons prêts&nbsp;&raquo; ne sont plus envoyées séparément
            — tout est consolidé dans le digest.
          </p>
        </div>
        {lastSent && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <Label className="text-muted-foreground">Dernier envoi</Label>
            <span className="tabular-nums text-foreground">
              {new Date(lastSent).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
