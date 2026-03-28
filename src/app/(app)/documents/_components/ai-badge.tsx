"use client";

import { useState } from "react";
import { Loader2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";

export function AiBadge({ status, id }: { status: string | null | undefined; id?: string }) {
  const [localStatus, setLocalStatus] = useState(status);
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (!id || retrying) return;
    setRetrying(true);
    setLocalStatus("pending");
    try {
      const res = await fetch(`/api/documents/${id}/analyze`, { method: "POST" });
      setLocalStatus(res.ok ? "done" : "error");
    } catch {
      setLocalStatus("error");
    } finally {
      setRetrying(false);
    }
  }

  if (!localStatus) return null;

  if (localStatus === "pending") {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
        <Loader2 className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Analyse…" : "Analyse…"}
        {id && !retrying && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void retry(); }}
            className="underline hover:text-foreground"
            title="Relancer l'analyse IA"
          >
            relancer
          </button>
        )}
      </span>
    );
  }
  if (localStatus === "done") {
    return (
      <span className="flex items-center gap-0.5 text-violet-500 text-[10px] font-medium" title="Analysé par IA">
        <Sparkles className="h-3 w-3" />IA
      </span>
    );
  }
  if (localStatus === "error") {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void retry(); }}
        className="flex items-center gap-0.5 text-muted-foreground/60 text-[10px] hover:text-foreground"
        title="Analyse échouée — cliquer pour réessayer"
      >
        <AlertCircle className="h-3 w-3" />Échec
        <RefreshCw className="h-2.5 w-2.5 ml-0.5" />
      </button>
    );
  }
  return null;
}
