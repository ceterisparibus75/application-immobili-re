"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Détecte un `UnrecognizedActionError` (Server Action hash inconnu) : ce
 * cas survient quand un user a une page ouverte avant un déploiement
 * et invoque une action dont le hash a changé. La seule sortie correcte
 * est de recharger pour récupérer la nouvelle build.
 */
function isStaleServerActionError(error: Error): boolean {
  const message = String(error?.message ?? "");
  return (
    /UnrecognizedActionError/i.test(message) ||
    /Server Action ".+" was not found on the server/i.test(message) ||
    /failed-to-find-server-action/i.test(message)
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleServerActionError(error);

  useEffect(() => {
    if (stale) return; // erreur attendue post-déploiement, ne pas polluer Sentry
    Sentry.captureException(error, {
      tags: { boundary: "app-error" },
    });
  }, [error, stale]);

  if (stale) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-semibold">Mise à jour disponible</h2>
        <p className="text-muted-foreground text-center max-w-md">
          L&apos;application a été mise à jour pendant que vous étiez sur cette page.
          Rechargez pour récupérer la dernière version.
        </p>
        <Button onClick={() => window.location.reload()} variant="default">
          Recharger
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Nous sommes désolés, quelque chose s&apos;est mal passé.
        Vous pouvez réessayer ou retourner au tableau de bord.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Référence : {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">Réessayer</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Tableau de bord</a>
        </Button>
      </div>
    </div>
  );
}
