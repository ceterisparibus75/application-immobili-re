"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Bot, Download, Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import { useTransition } from "react";
import {
  createRentValuation,
  runRentAiAnalysis,
  deleteRentValuation,
} from "@/actions/rent-valuation";
import { toast } from "sonner";
import Link from "next/link";

interface RentValuationItem {
  id: string;
  valuationDate: Date;
  status: string;
  currentRent: number | null;
  estimatedMarketRent: number | null;
  estimatedRentLow: number | null;
  estimatedRentHigh: number | null;
  rentPerSqm: number | null;
  deviationPercent: number | null;
  _count: {
    aiAnalyses: number;
    comparableRents: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
};

export function RentValuationPanel({
  valuations,
  leaseId,
  societyId,
}: {
  valuations: RentValuationItem[];
  leaseId: string;
  societyId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createRentValuation(societyId, { leaseId });
      if (result.success && result.data) {
        // Auto-launch AI analysis
        const aiResult = await runRentAiAnalysis(societyId, result.data.id, {
          providers: ["CLAUDE", "OPENAI"],
        });
        if (aiResult.success) {
          toast.success("Évaluation de loyer terminée");
        } else {
          toast.info("Évaluation créée mais l'analyse IA a échoué. Vous pouvez la relancer.");
        }
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette évaluation de loyer ?")) return;
    startTransition(async () => {
      const result = await deleteRentValuation(societyId, id);
      if (result.success) toast.success("Supprimée");
      else toast.error(result.error ?? "Erreur");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Évaluation des loyers IA
        </h3>
        <Button onClick={handleCreate} disabled={isPending} size="sm">
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {isPending ? "Analyse en cours..." : "Évaluer le loyer"}
        </Button>
      </div>

      {isPending && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Analyse par Claude et GPT-4o en cours (30-60s)...
            </p>
          </CardContent>
        </Card>
      )}

      {valuations.length === 0 && !isPending && (
        <Card>
          <CardContent className="py-8 text-center">
            <Bot className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune évaluation de loyer. Cliquez sur &quot;Évaluer le loyer&quot; pour lancer une analyse IA.
            </p>
          </CardContent>
        </Card>
      )}

      {valuations.map((v) => (
        <Card key={v.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={v.status === "COMPLETED" ? "success" : "secondary"}>
                    {STATUS_LABELS[v.status] ?? v.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {v._count.aiAnalyses} analyse(s) IA
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Loyer actuel</p>
                    <p className="font-medium">{v.currentRent ? formatCurrency(v.currentRent) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Loyer de marché</p>
                    <p className="font-semibold text-blue-600">
                      {v.estimatedMarketRent ? formatCurrency(v.estimatedMarketRent) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fourchette</p>
                    <p className="text-sm">
                      {v.estimatedRentLow && v.estimatedRentHigh
                        ? `${formatCurrency(v.estimatedRentLow)} — ${formatCurrency(v.estimatedRentHigh)}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Écart</p>
                    <p className={`font-medium ${
                      v.deviationPercent != null
                        ? v.deviationPercent > 0
                          ? "text-green-600"
                          : v.deviationPercent < -10
                            ? "text-red-600"
                            : "text-yellow-600"
                        : ""
                    }`}>
                      {v.deviationPercent != null
                        ? `${v.deviationPercent > 0 ? "+" : ""}${v.deviationPercent.toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-4">
                <Link href={`/api/valuations/${v.id}/pdf?type=rent`} target="_blank">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(v.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
