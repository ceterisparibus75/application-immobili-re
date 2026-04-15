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

interface MethodologyData {
  comparisonMethod?: { applied?: boolean; resultValue?: number | null; pricePerSqm?: number | null; reasoning?: string };
  incomeMethod?: { applied?: boolean; resultValue?: number | null; capRate?: number | null; reasoning?: string };
  weightingRationale?: string;
}

interface SummaryData {
  exploitationValue?: number | null;
  realisationValue?: number | null;
  renovationCosts?: number | null;
  abatementPercent?: number | null;
}

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
  structuredResult: unknown;
  strengths: unknown;
  weaknesses: unknown;
  opportunities: unknown;
  threats: unknown;
  durationMs: number | null;
  tokenCount: number | null;
  executedAt: Date;
}

function getMethodology(a: AiAnalysis): MethodologyData {
  try {
    const r = a.structuredResult as Record<string, unknown>;
    return (r?.methodology as MethodologyData) ?? {};
  } catch { return {}; }
}

function getSummaryExtra(a: AiAnalysis): SummaryData {
  try {
    const r = a.structuredResult as Record<string, unknown>;
    return (r?.summary as SummaryData) ?? {};
  } catch { return {}; }
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
        providers: ["CLAUDE", "OPENAI"],
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
            Recherche des comparables DVF puis analyse par Claude et GPT-4o...
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
                    { label: "Valeur retenue", render: (a: AiAnalysis) => a.estimatedValue ? <span className="font-bold text-[var(--color-brand-deep)]">{formatCurrency(a.estimatedValue)}</span> : "—" },
                    { label: "↳ par comparables", render: (a: AiAnalysis) => { const v = getMethodology(a).comparisonMethod?.resultValue; return v ? <span className="text-[var(--color-brand-blue)]">{formatCurrency(v)}</span> : "—"; } },
                    { label: "↳ par capitalisation", render: (a: AiAnalysis) => { const v = getMethodology(a).incomeMethod?.resultValue; return v ? <span className="text-purple-600">{formatCurrency(v)}</span> : "—"; } },
                    { label: "Valeur d'Exploitation", render: (a: AiAnalysis) => { const v = getSummaryExtra(a).exploitationValue; return v ? <span className="text-emerald-700 font-medium">{formatCurrency(v)}</span> : "—"; } },
                    { label: "Valeur de Réalisation", render: (a: AiAnalysis) => {
                      const s = getSummaryExtra(a);
                      const v = s.realisationValue;
                      if (!v) return "—";
                      const abatt = s.abatementPercent && s.abatementPercent > 0 ? ` (−${s.abatementPercent}%)` : "";
                      return <span className="text-orange-600 font-medium">{formatCurrency(v)}{abatt}</span>;
                    }},
                    { label: "Valeur locative", render: (a: AiAnalysis) => a.rentalValue ? formatCurrency(a.rentalValue) : "—" },
                    { label: "Taux capitalisation", render: (a: AiAnalysis) => a.capRate ? `${a.capRate.toFixed(1)}%` : "—" },
                    { label: "Prix/m²", render: (a: AiAnalysis) => a.pricePerSqm ? `${Math.round(a.pricePerSqm)} €` : "—" },
                    { label: "Confiance", render: (a: AiAnalysis) => {
                      if (!a.confidence) return "—";
                      const pct = a.confidence > 1 ? a.confidence : Math.round(a.confidence * 100);
                      return `${Math.round(pct)}%`;
                    }},
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
            <div className="mt-3 pt-3 border-t text-[10px] text-[#94A3B8] space-y-0.5">
              <p><span className="font-semibold text-[var(--color-status-positive)]">75-100%</span> Élevé — données suffisantes, comparables nombreux, estimation fiable</p>
              <p><span className="font-semibold text-[var(--color-status-caution)]">50-74%</span> Modéré — données partielles, à confirmer par un expert</p>
              <p><span className="font-semibold text-[var(--color-status-negative)]">0-49%</span> Faible — peu de données, estimation indicative uniquement</p>
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

              {/* Valeur d'Exploitation + Valeur de Réalisation */}
              {(() => {
                const s = getSummaryExtra(analysis);
                const hasExpl = s.exploitationValue != null;
                const hasReal = s.realisationValue != null;
                if (!hasExpl && !hasReal) return null;
                return (
                  <div className="rounded-lg border p-3 space-y-2 bg-gradient-to-r from-emerald-50 to-orange-50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Valeurs expertales</p>
                    <div className="grid grid-cols-2 gap-2">
                      {hasExpl && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-md p-2">
                          <p className="text-[10px] text-emerald-700 font-semibold">Valeur d&apos;Exploitation</p>
                          <p className="text-sm font-semibold text-[var(--color-brand-deep)] tabular-nums">{formatCurrency(s.exploitationValue!)}</p>
                          <p className="text-[10px] text-[#94A3B8]">Lots loués uniquement</p>
                        </div>
                      )}
                      {hasReal && (
                        <div className="bg-orange-50 border border-orange-100 rounded-md p-2">
                          <p className="text-[10px] text-orange-600 font-semibold">Valeur de Réalisation</p>
                          <p className="text-sm font-semibold text-[var(--color-brand-deep)] tabular-nums">{formatCurrency(s.realisationValue!)}</p>
                          <p className="text-[10px] text-[#94A3B8]">
                            Tous lots
                            {s.abatementPercent && s.abatementPercent > 0 ? ` · abatt. ${s.abatementPercent}%` : ""}
                            {s.renovationCosts && s.renovationCosts > 0 ? ` · réno déduite` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Décomposition par méthode */}
              {(() => {
                const m = getMethodology(analysis);
                const hasComp = m.comparisonMethod?.resultValue != null;
                const hasIncome = m.incomeMethod?.resultValue != null;
                if (!hasComp && !hasIncome) return null;
                return (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Détail des méthodes</p>
                    <div className="grid grid-cols-2 gap-2">
                      {hasComp && (
                        <div className="bg-blue-50 rounded-md p-2">
                          <p className="text-[10px] text-[var(--color-brand-blue)] font-semibold">Comparaison</p>
                          <p className="text-sm font-semibold text-[var(--color-brand-deep)] tabular-nums">{formatCurrency(m.comparisonMethod!.resultValue!)}</p>
                          {m.comparisonMethod?.pricePerSqm && (
                            <p className="text-[10px] text-[#94A3B8]">{Math.round(m.comparisonMethod.pricePerSqm)} €/m²</p>
                          )}
                        </div>
                      )}
                      {hasIncome && (
                        <div className="bg-purple-50 rounded-md p-2">
                          <p className="text-[10px] text-purple-600 font-semibold">Capitalisation</p>
                          <p className="text-sm font-semibold text-[var(--color-brand-deep)] tabular-nums">{formatCurrency(m.incomeMethod!.resultValue!)}</p>
                          {m.incomeMethod?.capRate && (
                            <p className="text-[10px] text-[#94A3B8]">Taux : {m.incomeMethod.capRate.toFixed(1)}%</p>
                          )}
                        </div>
                      )}
                    </div>
                    {m.weightingRationale && (
                      <p className="text-[10px] text-[#94A3B8] italic">{m.weightingRationale}</p>
                    )}
                  </div>
                );
              })()}

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
