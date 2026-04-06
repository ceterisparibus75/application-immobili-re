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
        providers: ["CLAUDE", "MISTRAL"],
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
        <h3 className="text-base font-semibold text-[var(--color-brand-deep)]">Analyses IA</h3>
        <Button onClick={handleRunAnalysis} disabled={isPending} className="bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-deep)] text-white">
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
        <div className="bg-white rounded-xl shadow-brand border-dashed border p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--color-brand-blue)]" />
          <p className="mt-4 text-sm text-[var(--color-brand-deep)]">
            Analyse en cours par Claude et Gemini...
          </p>
          <p className="text-[10px] text-[#94A3B8] mt-1">
            Cela peut prendre 30 à 60 secondes.
          </p>
        </div>
      )}

      {/* Tableau comparatif */}
      {analyses.length > 1 && (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">Comparaison des résultats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Critère</th>
                    {analyses.map((a) => (
                      <th key={a.id} className="text-right py-2.5 px-4 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">{a.provider}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Valeur vénale", render: (a: AiAnalysis) => a.estimatedValue ? formatCurrency(a.estimatedValue) : "—" },
                    { label: "Valeur locative", render: (a: AiAnalysis) => a.rentalValue ? formatCurrency(a.rentalValue) : "—" },
                    { label: "Prix/m²", render: (a: AiAnalysis) => a.pricePerSqm ? `${Math.round(a.pricePerSqm)} €` : "—" },
                    { label: "Taux cap.", render: (a: AiAnalysis) => a.capRate ? `${a.capRate.toFixed(1)}%` : "—" },
                    { label: "Confiance", render: (a: AiAnalysis) => a.confidence ? `${Math.round(a.confidence * 100)}%` : "—" },
                  ].map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-2.5 px-4 text-sm text-[#94A3B8]">{row.label}</td>
                      {analyses.map((a) => (
                        <td key={a.id} className="py-2.5 px-4 text-right font-medium text-[var(--color-brand-deep)] tabular-nums">
                          {row.render(a)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Détail par fournisseur */}
      <div className="grid gap-4 md:grid-cols-2">
        {analyses.map((analysis) => (
          <Card key={analysis.id} className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)] flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-brand-light)]">
                    <Bot className="h-3.5 w-3.5 text-[var(--color-brand-blue)]" />
                  </div>
                  {analysis.provider}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {analysis.modelVersion}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Valeur estimée</p>
                  <p className="text-lg font-semibold tabular-nums text-[var(--color-brand-deep)]">
                    {analysis.estimatedValue ? formatCurrency(analysis.estimatedValue) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Valeur locative</p>
                  <p className="text-lg font-semibold tabular-nums text-[var(--color-brand-deep)]">
                    {analysis.rentalValue ? formatCurrency(analysis.rentalValue) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Méthode</p>
                  <p className="text-xs text-[var(--color-brand-deep)]">{analysis.methodology ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Temps / Tokens</p>
                  <p className="text-xs text-[var(--color-brand-deep)]">
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
