"use client";

import { Loader2, Sparkles, AlertCircle } from "lucide-react";

export function AiBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  if (status === "pending") {
    return (
      <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
        <Loader2 className="h-3 w-3 animate-spin" />Analyse…
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        className="flex items-center gap-0.5 text-violet-500 text-[10px] font-medium"
        title="Analysé par IA"
      >
        <Sparkles className="h-3 w-3" />IA
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="flex items-center gap-0.5 text-muted-foreground/60 text-[10px]"
        title="Analyse échouée"
      >
        <AlertCircle className="h-3 w-3" />Échec
      </span>
    );
  }
  return null;
}
