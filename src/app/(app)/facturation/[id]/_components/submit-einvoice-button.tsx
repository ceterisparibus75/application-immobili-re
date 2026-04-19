"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle2, AlertCircle, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { submitInvoice } from "@/actions/einvoicing";

type Props = {
  invoiceId: string;
  societyId: string;
  alreadySubmitted?: boolean;
  flowId?: string | null;
  missingSiret?: boolean;
  missingEmail?: boolean;
};

type State = "idle" | "loading" | "success" | "error";

export function SubmitEInvoiceButton({ invoiceId, societyId, alreadySubmitted, flowId, missingSiret, missingEmail }: Props) {
  const [state, setState] = useState<State>(alreadySubmitted ? "success" : "idle");
  const [currentFlowId, setCurrentFlowId] = useState(flowId ?? null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit() {
    setState("loading");
    setErrorMsg(null);
    try {
      const result = await submitInvoice(societyId, invoiceId);
      if (result.success && result.data) {
        setState("success");
        setCurrentFlowId(result.data.flowId);
        toast.success("Facture transmise à la PA B2B", {
          description: `ID de flux : ${result.data.flowId}`,
        });
      } else {
        const msg = result.error ?? "Erreur inconnue";
        setState("error");
        setErrorMsg(msg);
        toast.error("Échec de transmission PA B2B", { description: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      setState("error");
      setErrorMsg(msg);
      toast.error("Erreur lors de la transmission PA B2B", { description: msg });
    }
  }

  if (state === "success") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title={currentFlowId ? `ID de flux PA : ${currentFlowId}` : "Facture transmise à la PA B2B"}
        className="text-green-600 border-green-300"
      >
        <CheckCircle2 className="h-4 w-4" />
        PA B2B envoyée
      </Button>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSubmit}
          className="text-destructive border-destructive/40"
          title={errorMsg ?? "Erreur PA B2B"}
        >
          <AlertCircle className="h-4 w-4" />
          Réessayer PA B2B
        </Button>
        {errorMsg && (
          <p className="text-xs text-destructive max-w-[200px] text-right leading-tight">
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  const hasWarning = missingSiret || missingEmail;

  return (
    <div className="flex flex-col items-end gap-1">
      {hasWarning && state === "idle" && (
        <div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 max-w-[220px]">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {[missingSiret && "SIRET", missingEmail && "email"].filter(Boolean).join(" et ")}{" "}
            manquant{missingSiret && missingEmail ? "s" : ""} dans les{" "}
            <Link href="/societes" className="underline font-medium">paramètres société</Link>.
          </span>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSubmit}
        disabled={state === "loading"}
        title="Transmettre cette facture à la Plateforme Agréée B2B (réforme facturation électronique)"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {state === "loading" ? "Transmission…" : "Envoyer PA B2B"}
      </Button>
    </div>
  );
}
