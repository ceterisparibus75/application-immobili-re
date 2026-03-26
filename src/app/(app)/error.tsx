"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Nous sommes désolés, quelque chose s&apos;est mal passé.
        Vous pouvez réessayer ou retourner au tableau de bord.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">Réessayer</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Tableau de bord</a>
        </Button>
      </div>
    </div>
  );
}
