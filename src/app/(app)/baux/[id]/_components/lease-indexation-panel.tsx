"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  applyCatchUpRevisions,
  createManualRevision,
  previewCatchUpRevisions,
  type CatchUpResult,
  type LeaseIndexationOverview,
} from "@/actions/rent-revision";
import { formatCurrency, formatDate } from "@/lib/utils";

function IndexRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function LeaseIndexationPanel({
  leaseId,
  societyId,
  indexation,
  isActive,
}: {
  leaseId: string;
  societyId: string;
  indexation: LeaseIndexationOverview | null;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCatchingUp, setIsCatchingUp] = useState(false);
  const [catchUpPreview, setCatchUpPreview] = useState<CatchUpResult | null>(null);

  async function handleGenerateRevision() {
    if (!indexation?.nextRevisionDate || !indexation.referenceIndexValue) return;

    setIsGenerating(true);
    const result = await createManualRevision(societyId, {
      leaseId,
      effectiveDate: indexation.nextRevisionDate,
      newIndexValue: indexation.referenceIndexValue,
    });
    setIsGenerating(false);

    if (result.success) {
      toast.success("Révision préparée sur ce bail");
      router.refresh();
    } else {
      toast.error(result.error ?? "Impossible de préparer la révision");
    }
  }

  async function handlePreviewCatchUp() {
    setIsCatchingUp(true);
    const result = await previewCatchUpRevisions(societyId, leaseId);
    setIsCatchingUp(false);

    if (result.success && result.data) {
      setCatchUpPreview(result.data);
    } else {
      toast.error(result.error ?? "Impossible de calculer les révisions en retard");
    }
  }

  async function handleApplyCatchUp() {
    setIsCatchingUp(true);
    const result = await applyCatchUpRevisions(societyId, leaseId);
    setIsCatchingUp(false);
    setCatchUpPreview(null);

    if (result.success && result.data) {
      toast.success(`Révisions appliquées : nouveau loyer ${formatCurrency(result.data.finalRent)} HT`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Impossible d'appliquer les révisions");
    }
  }

  if (!indexation) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Indexation du loyer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Impossible de charger le résumé d'indexation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Indexation du loyer
            </CardTitle>
            <Badge variant={indexation.statusVariant} className="shrink-0">
              {indexation.statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!indexation.isIndexed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ce bail n'a pas de clause d'indexation configurée.
              </p>
              {isActive && (
                <Link href={`/baux/${leaseId}/modifier`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings className="h-3.5 w-3.5" />
                    Configurer l'indexation
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <IndexRow
                  label="Indice"
                  value={
                    indexation.indexType === "POURCENTAGE_FIXE"
                      ? "Taux fixe annuel"
                      : (indexation.indexType ?? "—")
                  }
                />
                <IndexRow
                  label="Référence du bail"
                  value={
                    indexation.indexType === "POURCENTAGE_FIXE"
                      ? "Contractuelle (pas d'indice INSEE)"
                      : indexation.baseIndexValue
                        ? `${indexation.baseIndexValue}${indexation.baseIndexQuarter ? ` · ${indexation.baseIndexQuarter}` : ""}`
                        : "À compléter"
                  }
                />
                <IndexRow
                  label={indexation.indexType === "POURCENTAGE_FIXE" ? "Taux appliqué" : "Indice utilisé"}
                  value={
                    indexation.indexType === "POURCENTAGE_FIXE"
                      ? (indexation.referenceIndexQuarter ?? "—")
                      : indexation.referenceIndexValue
                        ? [
                            indexation.referenceIndexValue,
                            indexation.referenceIndexQuarter,
                            indexation.referenceIndexYear,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "Indisponible"
                  }
                />
                <IndexRow
                  label="Prochaine échéance"
                  value={indexation.nextRevisionDate ? formatDate(indexation.nextRevisionDate) : "—"}
                />
                <IndexRow
                  label="Fréquence"
                  value={`Tous les ${indexation.revisionFrequency ?? 12} mois`}
                />
                <IndexRow
                  label="Révisions en retard"
                  value={indexation.missedRevisions > 0 ? String(indexation.missedRevisions) : "Aucune"}
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-3">
                {indexation.pendingRevision ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Révision en attente de validation</p>
                      <p className="text-xs text-muted-foreground">
                        Effet au {formatDate(indexation.pendingRevision.effectiveDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">{formatCurrency(indexation.currentRentHT)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold text-primary">
                        {formatCurrency(indexation.pendingRevision.newRentHT)}
                      </span>
                    </div>
                  </div>
                ) : indexation.estimatedNewRentHT ? (
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium">Loyer révisé estimé</p>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">{formatCurrency(indexation.currentRentHT)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-primary">
                          {formatCurrency(indexation.estimatedNewRentHT)}
                        </span>
                      </div>
                    </div>
                    {indexation.formula && (
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {indexation.formula}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun calcul disponible pour le moment.
                  </p>
                )}
              </div>

              {(indexation.legalNote || indexation.blockReason) && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{indexation.blockReason ?? indexation.legalNote}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {isActive && indexation.canGenerateRevision && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleGenerateRevision}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Préparer la révision
                  </Button>
                )}
                {isActive && indexation.canCatchUp && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={handlePreviewCatchUp}
                    disabled={isCatchingUp}
                  >
                    {isCatchingUp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Traiter le retard
                  </Button>
                )}
                <Link href={`/baux/${leaseId}/modifier`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings className="h-3.5 w-3.5" />
                    Paramètres
                  </Button>
                </Link>
                <Link href="/indices">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Indices INSEE
                  </Button>
                </Link>
                <Link href="/baux/revisions">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Révisions
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(catchUpPreview)} onOpenChange={(open) => !open && setCatchUpPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traiter les révisions en retard</DialogTitle>
            <DialogDescription>
              Seules les révisions affichées seront appliquées au bail.
            </DialogDescription>
          </DialogHeader>
          {catchUpPreview && (
            <div className="space-y-3">
              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {catchUpPreview.steps.map((step) => (
                  <div key={`${step.year}-${step.quarter}`} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">T{step.quarter} {step.year}</span>
                      <span className="tabular-nums">
                        {formatCurrency(step.rentBefore)} → {formatCurrency(step.rentAfter)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                      {step.rentBefore.toFixed(2)} × ({step.toIndex.toFixed(2)} / {step.fromIndex.toFixed(2)}) = {step.rentAfter.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Loyer final</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(catchUpPreview.finalRent)} HT
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatchUpPreview(null)}>
              Annuler
            </Button>
            <Button onClick={handleApplyCatchUp} disabled={isCatchingUp} className="gap-1.5">
              {isCatchingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
