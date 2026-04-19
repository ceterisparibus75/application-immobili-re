"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { getEInvoiceStatus } from "@/actions/einvoicing";

const STATUS_LABELS: Record<string, string> = {
  DEPOSEE: "Déposée",
  EN_COURS_TRAITEMENT: "En cours de traitement",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
  TRANSMISE: "Transmise",
  MISE_A_DISPOSITION: "Mise à disposition",
  RECUE: "Reçue",
  REFUSEE: "Refusée",
  EN_COURS_DE_PAIEMENT: "En cours de paiement",
  PAYEE: "Payée",
  ABANDONNER: "Abandonnée",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  DEPOSEE: "secondary",
  EN_COURS_TRAITEMENT: "default",
  VALIDEE: "success",
  REJETEE: "destructive",
  TRANSMISE: "default",
  MISE_A_DISPOSITION: "default",
  RECUE: "success",
  REFUSEE: "destructive",
  EN_COURS_DE_PAIEMENT: "warning",
  PAYEE: "success",
  ABANDONNER: "outline",
};

type Props = {
  invoiceId: string;
  societyId: string;
  flowId: string;
  submittedAt: Date | null;
};

export function PaStatusCard({ invoiceId, societyId, flowId, submittedAt }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setChecking(true);
    setError(null);
    try {
      const result = await getEInvoiceStatus(societyId, invoiceId);
      if (result.success && result.data) {
        setStatus(result.data.currentStatus);
      } else {
        setError(result.error ?? "Impossible de récupérer le statut");
      }
    } catch {
      setError("Erreur lors de la vérification du statut");
    }
    setChecking(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Transmission PA B2B</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} disabled={checking} title="Vérifier le statut sur la Plateforme Agréée">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">ID de flux</p>
          <p className="text-xs font-mono text-right truncate max-w-[160px]" title={flowId}>{flowId}</p>
        </div>
        {submittedAt && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Transmise le</p>
            <p className="text-xs">{new Date(submittedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Statut PA</p>
          {status ? (
            <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className="text-xs">
              {STATUS_LABELS[status] ?? status}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              {error ?? "Cliquez sur ↻ pour vérifier"}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
