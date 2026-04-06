"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_VARIANTS: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  DRAFT: "secondary",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  ARCHIVED: "destructive",
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
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Aucun avis de valeur pour cet immeuble.</p>
          <p className="text-sm text-muted-foreground">Cliquez sur &quot;Nouvel avis de valeur&quot; pour commencer.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {valuations.map((v) => (
        <Card key={v.id} className="hover:bg-muted/30 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">
                  Avis du {formatDate(v.valuationDate)}
                </CardTitle>
                <Badge variant={STATUS_VARIANTS[v.status] ?? "secondary"}>
                  {STATUS_LABELS[v.status] ?? v.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(v.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Link href={`/patrimoine/immeubles/${buildingId}/valorisation/${v.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {v.estimatedValueMid && (
                <span>
                  Valeur : <span className="font-medium text-foreground">{formatCurrency(v.estimatedValueMid)}</span>
                </span>
              )}
              {v.pricePerSqm && (
                <span>{Math.round(v.pricePerSqm)} €/m²</span>
              )}
              <span>{v._count.aiAnalyses} analyse(s) IA</span>
              <span>{v._count.expertReports} rapport(s) expert</span>
              <span>{v._count.comparableSales} comparable(s)</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
