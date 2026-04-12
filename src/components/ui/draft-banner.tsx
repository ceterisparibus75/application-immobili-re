"use client";

import { FileWarning, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DraftBannerProps {
  lastSaved: Date | null;
  onRestore: () => void;
  onDiscard: () => void;
}

/**
 * Bannière affichée quand un brouillon existe pour le formulaire en cours.
 */
export function DraftBanner({ lastSaved, onRestore, onDiscard }: DraftBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-4 py-3 mb-4 animate-slide-down">
      <FileWarning className="h-4 w-4 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Un brouillon non envoyé a été trouvé
        </p>
        {lastSaved && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Sauvegardé {formatDistanceToNow(lastSaved, { addSuffix: true, locale: fr })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-amber-300" onClick={onRestore}>
          <RotateCcw className="h-3 w-3" />
          Restaurer
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600" onClick={onDiscard}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
