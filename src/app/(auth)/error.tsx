"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center space-y-4">
      <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Impossible de charger cette page. Veuillez réessayer.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Réf : {error.digest}
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <Button onClick={reset} size="sm">Réessayer</Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/login">Retour à la connexion</a>
        </Button>
      </div>
    </div>
  );
}
