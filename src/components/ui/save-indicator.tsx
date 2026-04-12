"use client";

import { Check, Loader2 } from "lucide-react";

interface SaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "error";
  lastSaved?: Date | null;
}

/**
 * Indicateur d'état de sauvegarde.
 * Affiche "Enregistrement...", "Enregistré à HH:MM" ou une erreur.
 */
export function SaveIndicator({ status, lastSaved }: SaveIndicatorProps) {
  if (status === "idle" && !lastSaved) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-in">
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="animate-save-pulse">Enregistrement…</span>
        </>
      )}
      {status === "saved" && lastSaved && (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span>
            Enregistré à{" "}
            {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </>
      )}
      {status === "error" && (
        <span className="text-destructive">Erreur de sauvegarde</span>
      )}
    </div>
  );
}
