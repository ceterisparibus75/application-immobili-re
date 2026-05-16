"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, RefreshCw, CheckCircle2, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ChorusProCardProps {
  isConfigured: boolean; // PISTE + compte technique configurés
}

export function ChorusProCard({ isConfigured }: ChorusProCardProps) {
  const [testing, setTesting] = useState(false);

  async function handleTestConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/chorus-pro/test-connection");
      const data = await res.json();
      if (data.ok) {
        toast.success("Connexion PISTE réussie — le token OAuth2 a été obtenu.");
      } else {
        toast.error(data.error ?? data.message ?? "Connexion PISTE échouée");
      }
    } catch {
      toast.error("Erreur réseau — impossible de contacter PISTE.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">
                Chorus Pro — Facturation B2G
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                Émettez des factures vers le secteur public (État, collectivités, hôpitaux…)
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={isConfigured ? "default" : "secondary"}
            className={isConfigured ? "bg-green-100 text-green-700 border-green-200" : ""}
          >
            {isConfigured ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Configuré</>
            ) : (
              "Non configuré"
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConfigured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Configuration requise
            </div>
            <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
              <li>
                Connectez-vous sur{" "}
                <a
                  href="https://piste.gouv.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium inline-flex items-center gap-0.5"
                >
                  piste.gouv.fr <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → Applications → Abonnements → souscrire à <strong>Factures</strong> (cpro.factures)
              </li>
              <li>
                Créez un compte technique sur{" "}
                <a
                  href="https://portail.chorus-pro.gouv.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium inline-flex items-center gap-0.5"
                >
                  portail.chorus-pro.gouv.fr <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → Espace EDI &amp; API
              </li>
              <li>
                Ajoutez dans <code className="bg-amber-100 px-1 rounded">.env.local</code> :{" "}
                <code className="bg-amber-100 px-1 rounded">CHORUS_PRO_TECH_ACCOUNT</code>,{" "}
                <code className="bg-amber-100 px-1 rounded">CHORUS_PRO_TECH_PASSWORD</code>,{" "}
                <code className="bg-amber-100 px-1 rounded">CHORUS_PRO_TECH_USER_ID</code>
              </li>
            </ol>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Chorus Pro est configuré. Les factures envoyées à des entités publiques
                seront déposées automatiquement via PISTE.
              </span>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="h-3.5 w-3.5" />
            Quand utiliser Chorus Pro ?
          </div>
          <p>
            Chorus Pro est obligatoire pour facturer les acheteurs publics (État, collectivités
            territoriales, hôpitaux, établissements publics). Il est distinct de la réforme B2B
            secteur privé de septembre 2026.
          </p>
        </div>

        {isConfigured && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${testing ? "animate-spin" : ""}`} />
            Tester la connexion PISTE
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
