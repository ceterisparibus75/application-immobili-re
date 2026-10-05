"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useSociety } from "@/providers/society-provider";
import { diagnosePowensRenewal } from "@/actions/bank-connection";
import { Loader2, Stethoscope } from "lucide-react";

interface Props {
  connectionId: string;
}

type Diag = Awaited<ReturnType<typeof diagnosePowensRenewal>>;

export function PowensDiagnosticButton({ connectionId }: Props) {
  const { activeSociety } = useSociety();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Diag | null>(null);

  function handleRun() {
    if (!activeSociety) return;
    setResult(null);
    startTransition(async () => {
      const res = await diagnosePowensRenewal(activeSociety.id, connectionId);
      setResult(res);
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={handleRun} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
        Diagnostiquer Powens
      </Button>

      {result && (
        <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono space-y-1">
          {!result.success ? (
            <p className="text-destructive">Erreur : {result.error}</p>
          ) : result.data ? (
            <>
              <Row label="redirect_uri" value={result.data.redirectUri} highlight />
              <Row label="domain (env)" value={result.data.powensDomain} />
              <Row label="client_id" value={result.data.clientId} />
              <Row label="user Powens" value={result.data.powensUserId ?? "—"} />
              <Row label="connection Powens" value={result.data.powensConnectionId ?? "—"} />
              <Row label="connector" value={result.data.connectorId ?? "—"} />
              <Row label="check connexion" value={result.data.connectionCheckResult} />
              {result.data.connectionCheckError && (
                <Row label="err. check" value={result.data.connectionCheckError} />
              )}
              <Row
                label="mode webview"
                value={result.data.mode === "reconnect" ? "/fr/reconnect" : "/fr/connect"}
                highlight
              />
              <p className="pt-2 text-[11px] font-sans text-muted-foreground">
                Compare la ligne <strong>redirect_uri</strong> ci-dessus avec la whitelist
                de ta console Powens (section « Redirect URIs »). Caractère par caractère.
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0 w-32">{label}</span>
      <span className={highlight ? "font-semibold break-all" : "break-all"}>{value}</span>
    </div>
  );
}
