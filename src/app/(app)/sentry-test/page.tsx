"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SentryTestPage() {
  return (
    <div className="container max-w-lg py-12">
      <Card>
        <CardHeader>
          <CardTitle>Test Sentry</CardTitle>
          <CardDescription>
            Cliquez sur le bouton pour envoyer une erreur de test à Sentry.
            Vérifiez ensuite sur sentry.io que l&apos;erreur apparaît.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="destructive"
            onClick={() => {
              Sentry.captureException(new Error("Test Sentry — MyGestia fonctionne correctement !"));
              alert("Erreur envoyée à Sentry ! Vérifiez votre dashboard sentry.io.");
            }}
          >
            Envoyer une erreur de test
          </Button>
          <p className="text-xs text-muted-foreground">
            Cette page est réservée aux administrateurs. Supprimez-la après validation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
