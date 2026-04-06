"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart3, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteValuation } from "@/actions/valuation";
import { toast } from "sonner";
import { useTransition } from "react";

interface ValuationListItem {
  id: string;
  valuationDate: Date;
  status: string;
  estimatedValueMid: number | null;
  pricePerSqm: number | null;
  _count: {
    aiAnalyses: number;
    expertReports: number;
    comparableSales: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
};

export function ValuationList({
  valuations,
  buildingId,
  societyId,
}: {
  valuations: ValuationListItem[];
  buildingId: string;
  societyId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(valuationId: string) {
    if (!confirm("Supprimer cette évaluation et toutes ses données associées ?")) return;
    startTransition(async () => {
      const result = await deleteValuation(societyId, valuationId);
      if (result.success) {
        toast.success("Évaluation supprimée");
      } else {
        toast.error(result.error ?? "Erreur");
      }
    });
  }

  if (valuations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-brand py-12 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-[#94A3B8]/40" />
        <p className="mt-4 text-sm text-[var(--color-brand-deep)]">Aucun avis de valeur pour cet immeuble.</p>
        <p className="text-[10px] text-[#94A3B8]">Cliquez sur &quot;Nouvel avis de valeur&quot; pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {valuations.map((v) => (
        <Card key={v.id} className="border-0 shadow-brand bg-white rounded-xl hover:shadow-brand-lg transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <p className="text-sm font-semibold text-[var(--color-brand-deep)]">
                      Avis du {formatDate(v.valuationDate)}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium ${
                        v.status === "COMPLETED"
                          ? "border-[var(--color-status-positive)] text-[var(--color-status-positive)] bg-[var(--color-status-positive-bg)]"
                          : v.status === "IN_PROGRESS"
                            ? "border-[var(--color-status-caution)] text-[var(--color-status-caution)] bg-[var(--color-status-caution-bg)]"
                            : ""
                      }`}
                    >
                      {STATUS_LABELS[v.status] ?? v.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                    {v.estimatedValueMid && (
                      <span>
                        Valeur : <span className="font-semibold text-[var(--color-brand-deep)] tabular-nums">{formatCurrency(v.estimatedValueMid)}</span>
                      </span>
                    )}
                    {v.pricePerSqm && (
                      <span className="tabular-nums">{Math.round(v.pricePerSqm)} €/m²</span>
                    )}
                    <span>{v._count.aiAnalyses} analyse(s) IA</span>
                    <span>{v._count.expertReports} rapport(s)</span>
                    <span>{v._count.comparableSales} comparable(s)</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#94A3B8] hover:text-[var(--color-status-negative)]"
                  onClick={() => handleDelete(v.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Link href={`/patrimoine/immeubles/${buildingId}/valorisation/${v.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94A3B8] hover:text-[var(--color-brand-blue)]">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
