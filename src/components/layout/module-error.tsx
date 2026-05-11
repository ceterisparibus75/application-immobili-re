"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  moduleName: string;
};

export function ModuleError({ error, reset, moduleName }: Props) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "module-error", module: moduleName },
    });
  }, [error, moduleName]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 rounded-xl border bg-card p-8">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold">Erreur dans le module {moduleName}</h2>
      <p className="text-muted-foreground text-center max-w-md text-sm">
        Cette section a rencontré un problème. Le reste de l&apos;application reste accessible.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Référence : {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset} variant="default" size="sm">Réessayer</Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/dashboard">Tableau de bord</a>
        </Button>
      </div>
    </div>
  );
}
