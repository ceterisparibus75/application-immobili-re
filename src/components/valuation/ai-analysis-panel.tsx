"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Bot, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { runAiAnalysis } from "@/actions/valuation";
import { toast } from "sonner";
import { SwotChart } from "./swot-chart";
import { ConfidenceGauge } from "./confidence-gauge";

interface AiAnalysis {
  id: string;
  provider: string;
  modelVersion: string;
  estimatedValue: number | null;
  rentalValue: number | null;
  pricePerSqm: number | null;
  capRate: number | null;
  confidence: number | null;
  methodology: string | null;
  strengths: unknown;
  weaknesses: unknown;
  opportunities: unknown;
  threats: unknown;
  durationMs: number | null;
  tokenCount: number | null;
  executedAt: Date;
}

export function AiAnalysisPanel({
  analyses,
  valuationId,
  societyId,
}: {
  analyses: AiAnalysis[];
  valuationId: string;
  societyId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRunAnalysis() {
    startTransition(async () => {
      const result = await runAiAnalysis(societyId, valuationId, {
        providers: ["CLAUDE", "GEMINI"],
      });
      if (result.success) {
        toast.success(`${result.data?.analysisCount ?? 0} analyse(s) terminée(s)`);
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analyses IA</h3>
        <Button onClick={handleRunAnalysis} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 mr-2" />
              Lancer l&apos;analyse IA
            </>
          )}
        </Button>
      </div>

      {isPending && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Analyse en cours par Claude et Gemini...
            </p>
            <p className="text-sm text-muted-foreground">
              Cela peut prendre 30 à 60 secondes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tableau comparatif */}
      {analyses.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparaison des résultats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Critère</th>
                    {analyses.map((a) => (
                      <th key={a.id} className="text-right py-2 font-medium">{a.provider}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Valeur vénale</td>
                    {analyses.map((a) => (
                      <td key={a.id} className="py-2 text-right font-medium">
                        {a.estimatedValue ? formatCurrency(a.estimatedValue) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Valeur locative</td>
                    {analyses.map((a) => (
                      <td key={a.id} className="py-2 text-right">
                        {a.rentalValue ? formatCurrency(a.rentalValue) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Prix/m²</td>
                    {analyses.map((a) => (
                      <td key={a.id} className="py-2 text-right">
                        {a.pricePerSqm ? `${Math.round(a.pricePerSqm)} €` : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Taux cap.</td>
                    {analyses.map((a) => (
                      <td key={a.id} className="py-2 text-right">
                        {a.capRate ? `${a.capRate.toFixed(1)}%` : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Confiance</td>
                    {analyses.map((a) => (
                      <td key={a.id} className="py-2 text-right">
                        {a.confidence ? `${Math.round(a.confidence * 100)}%` : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Détail par fournisseur */}
      <div className="grid gap-4 md:grid-cols-2">
        {analyses.map((analysis) => (
          <Card key={analysis.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {analysis.provider}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {analysis.modelVersion}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Valeur estimée</p>
                  <p className="font-semibold">{analysis.estimatedValue ? formatCurrency(analysis.estimatedValue) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valeur locative</p>
                  <p className="font-semibold">{analysis.rentalValue ? formatCurrency(analysis.rentalValue) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Méthode</p>
                  <p className="text-xs">{analysis.methodology ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Temps / Tokens</p>
                  <p className="text-xs">
                    {analysis.durationMs ? `${(analysis.durationMs / 1000).toFixed(1)}s` : "—"}
                    {analysis.tokenCount ? ` / ${analysis.tokenCount} tokens` : ""}
                  </p>
                </div>
              </div>

              {analysis.confidence != null && (
                <ConfidenceGauge value={analysis.confidence} />
              )}

              <SwotChart
                strengths={(analysis.strengths as string[]) ?? []}
                weaknesses={(analysis.weaknesses as string[]) ?? []}
                opportunities={(analysis.opportunities as string[]) ?? []}
                threats={(analysis.threats as string[]) ?? []}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
