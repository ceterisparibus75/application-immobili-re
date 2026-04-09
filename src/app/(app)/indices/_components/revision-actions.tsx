"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2,
  Clock,
  CalendarClock,
  Play,
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createManualRevision,
  validateRevision,
  rejectRevision,
  previewCatchUpRevisions,
  applyCatchUpRevisions,
  type ChainStep,
  type CatchUpResult,
} from "@/actions/rent-revision";

// -- Types -------------------------------------------------------------------

interface LeaseRevisionData {
  id: string;
  tenantName: string;
  lotLabel: string;
  indexType: string;
  currentRentHT: number;
  baseRentHT: number;
  baseIndexValue: number | null;
  baseIndexQuarter: string | null;
  nextRevisionDate: string;
  statusVariant: "destructive" | "warning" | "default" | "secondary";
  statusLabel: string;
  lastRevisionDate: string | null;
  lastRevisionNewRent: number | null;
  pendingRevisionId: string | null;
  pendingNewRent: number | null;
  pendingFormula: string | null;
  referenceIndexValue: number | null;
  referenceIndexQuarter: string | null;
  referenceIndexYear: number | null;
  missedYears: number;
}

interface LatestIndexData {
  type: string;
  value: number;
  quarter: number;
  year: number;
}

interface RevisionActionsProps {
  societyId: string;
  leases: LeaseRevisionData[];
  latestIndices: LatestIndexData[];
}

// -- Composant principal -----------------------------------------------------

export function RevisionActions({
  societyId,
  leases,
  latestIndices,
}: RevisionActionsProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [catchingUp, setCatchingUp] = useState<string | null>(null);
  const [catchUpPreview, setCatchUpPreview] = useState<CatchUpResult | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "generate" | "validate" | "reject" | "generateAll" | "catchUp";
    lease?: LeaseRevisionData;
    newRent?: number;
    formula?: string;
  } | null>(null);

  const indexMap = new Map(latestIndices.map((i) => [i.type, i]));

  // Baux eligibles pour révision simple (1 an de retard max)
  const eligibleForGeneration = leases.filter(
    (l) =>
      !l.pendingRevisionId &&
      (l.statusVariant === "destructive" || l.statusVariant === "warning") &&
      l.baseIndexValue &&
      (l.referenceIndexValue || indexMap.has(l.indexType)) &&
      l.missedYears <= 1
  );

  // Baux nécessitant un rattrapage multi-années
  const needsCatchUp = leases.filter(
    (l) =>
      !l.pendingRevisionId &&
      (l.statusVariant === "destructive" || l.statusVariant === "warning") &&
      l.baseIndexValue &&
      l.missedYears > 1
  );

  // Baux avec revision en attente
  const pendingRevisions = leases.filter((l) => l.pendingRevisionId);

  function previewRevision(
    lease: LeaseRevisionData
  ): { newRent: number; formula: string; indexValue: number } | null {
    // Utiliser l'indice de référence du bail (même trimestre, année cible)
    const indexValue = lease.referenceIndexValue ?? indexMap.get(lease.indexType)?.value ?? null;
    if (!indexValue || !lease.baseIndexValue) return null;
    const newRent =
      Math.round(
        lease.currentRentHT * (indexValue / lease.baseIndexValue) * 100
      ) / 100;
    const newQuarterLabel = lease.referenceIndexQuarter && lease.referenceIndexYear
      ? ` [${lease.referenceIndexQuarter} ${lease.referenceIndexYear}]`
      : "";
    const baseQuarterLabel = lease.baseIndexQuarter
      ? ` [${lease.baseIndexQuarter}]`
      : "";
    const formula = `${lease.currentRentHT.toFixed(2)} × (${indexValue}${newQuarterLabel} / ${lease.baseIndexValue}${baseQuarterLabel}) = ${newRent.toFixed(2)}`;
    return { newRent, formula, indexValue };
  }

  /** Retourne un message d'erreur explicatif si le bail ne peut pas etre revise */
  function getRevisionBlockReason(lease: LeaseRevisionData): string | null {
    if (!lease.baseIndexValue)
      return "Aucun indice de base defini sur ce bail. Modifiez le bail pour ajouter un indice de reference.";
    if (!lease.referenceIndexValue && !indexMap.has(lease.indexType))
      return `Aucune valeur d'indice ${lease.indexType} disponible en base. L'indice sera recupere lors de la prochaine synchronisation INSEE.`;
    if (!lease.referenceIndexValue && lease.baseIndexQuarter)
      return `L'indice ${lease.indexType} du trimestre de reference (${lease.baseIndexQuarter}) n'est pas encore disponible.`;
    return null;
  }

  function handleGenerate(lease: LeaseRevisionData) {
    // Verifier les pre-requis et afficher un message clair si manquant
    const blockReason = getRevisionBlockReason(lease);
    if (blockReason) {
      toast.error(blockReason);
      return;
    }

    const preview = previewRevision(lease);
    if (!preview) return;

    setConfirmDialog({
      type: "generate",
      lease,
      newRent: preview.newRent,
      formula: preview.formula,
    });
  }

  async function confirmGenerate(lease: LeaseRevisionData) {
    const preview = previewRevision(lease);
    if (!preview) return;

    setGenerating(lease.id);
    setConfirmDialog(null);

    const result = await createManualRevision(societyId, {
      leaseId: lease.id,
      effectiveDate: new Date().toISOString(),
      newIndexValue: preview.indexValue,
    });

    setGenerating(null);
    if (result.success) {
      toast.success("Revision generee — en attente de validation");
    } else {
      toast.error(result.error ?? "Erreur lors de la generation");
    }
  }

  function handleGenerateAll() {
    setConfirmDialog({ type: "generateAll" });
  }

  async function confirmGenerateAll() {
    setGeneratingAll(true);
    setConfirmDialog(null);

    let success = 0;
    let errors = 0;

    for (const lease of eligibleForGeneration) {
      const preview = previewRevision(lease);
      if (!preview) {
        errors++;
        continue;
      }

      const result = await createManualRevision(societyId, {
        leaseId: lease.id,
        effectiveDate: new Date().toISOString(),
        newIndexValue: preview.indexValue,
      });

      if (result.success) success++;
      else errors++;
    }

    setGeneratingAll(false);
    if (success > 0)
      toast.success(
        `${success} revision${success > 1 ? "s" : ""} generee${success > 1 ? "s" : ""}`
      );
    if (errors > 0) toast.error(`${errors} erreur${errors > 1 ? "s" : ""}`);
  }

  function handleValidate(lease: LeaseRevisionData) {
    if (!lease.pendingRevisionId) return;
    setConfirmDialog({ type: "validate", lease });
  }

  async function confirmValidate(lease: LeaseRevisionData) {
    if (!lease.pendingRevisionId) return;
    setValidating(lease.pendingRevisionId);
    setConfirmDialog(null);

    const result = await validateRevision(societyId, lease.pendingRevisionId);
    setValidating(null);

    if (result.success) {
      toast.success(
        `Loyer mis a jour : ${formatCurrency(result.data!.newRentHT)} HT`
      );
    } else {
      toast.error(result.error ?? "Erreur lors de la validation");
    }
  }

  function handleReject(lease: LeaseRevisionData) {
    if (!lease.pendingRevisionId) return;
    setConfirmDialog({ type: "reject", lease });
  }

  async function confirmReject(lease: LeaseRevisionData) {
    if (!lease.pendingRevisionId) return;
    setRejecting(lease.pendingRevisionId);
    setConfirmDialog(null);

    const result = await rejectRevision(societyId, lease.pendingRevisionId);
    setRejecting(null);

    if (result.success) {
      toast.success("Revision annulee");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  // ── Catch-up (rattrapage chaîné) ─────────────────────────────────────

  async function handleCatchUp(lease: LeaseRevisionData) {
    setCatchingUp(lease.id);
    const result = await previewCatchUpRevisions(societyId, lease.id);
    setCatchingUp(null);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Impossible de calculer le rattrapage");
      return;
    }

    setCatchUpPreview(result.data);
    setConfirmDialog({ type: "catchUp", lease });
  }

  async function confirmCatchUp(lease: LeaseRevisionData) {
    setCatchingUp(lease.id);
    setConfirmDialog(null);

    const result = await applyCatchUpRevisions(societyId, lease.id);
    setCatchingUp(null);
    setCatchUpPreview(null);

    if (result.success && result.data) {
      toast.success(
        `Rattrapage appliqué : ${result.data.stepsCount} révision${result.data.stepsCount > 1 ? "s" : ""} — nouveau loyer : ${formatCurrency(result.data.finalRent)} HT`
      );
    } else {
      toast.error(result.error ?? "Erreur lors du rattrapage");
    }
  }

  const statusConfig: Record<
    string,
    { icon: typeof AlertTriangle; color: string }
  > = {
    destructive: { icon: AlertTriangle, color: "text-[var(--color-status-negative)]" },
    warning: { icon: Clock, color: "text-[var(--color-status-caution)]" },
    secondary: { icon: CalendarClock, color: "text-muted-foreground" },
    default: { icon: CheckCircle2, color: "text-[var(--color-status-positive)]" },
  };

  return (
    <>
      {/* Bandeau generation groupee */}
      {eligibleForGeneration.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {eligibleForGeneration.length}{" "}
              {eligibleForGeneration.length > 1 ? "baux éligibles" : "bail éligible"} à une révision
            </p>
            <p className="text-xs text-muted-foreground">
              Generer les propositions de revision en un clic
            </p>
          </div>
          <Button
            onClick={handleGenerateAll}
            disabled={generatingAll}
            className="gap-2 shrink-0"
          >
            {generatingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              Generer{" "}
              {eligibleForGeneration.length > 1 ? "toutes les " : "la "}
              revision{eligibleForGeneration.length > 1 ? "s" : ""}
            </span>
            <span className="sm:hidden">Generer</span>
          </Button>
        </div>
      )}

      {/* Bandeau rattrapage multi-années */}
      {needsCatchUp.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 px-4 py-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {needsCatchUp.length} {needsCatchUp.length > 1 ? "baux nécessitent" : "bail nécessite"} un rattrapage multi-années
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Les révisions seront chaînées année par année avec arrondi intermédiaire
            </p>
          </div>
        </div>
      )}

      {/* Tableau des baux */}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="pb-2.5 text-left font-medium pl-3">Locataire / Lot</th>
              <th className="pb-2.5 text-center font-medium w-16">Indice</th>
              <th className="pb-2.5 text-right font-medium">Loyer HT</th>
              <th className="pb-2.5 text-center font-medium hidden md:table-cell">
                Indice base
              </th>
              <th className="pb-2.5 text-center font-medium">Prochaine rev.</th>
              <th className="pb-2.5 text-center font-medium w-28">Statut</th>
              <th className="pb-2.5 text-right font-medium pr-3 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leases.map((lease) => {
              const config = statusConfig[lease.statusVariant] ?? statusConfig.default;
              const StatusIcon = config.icon;
              const isPending = !!lease.pendingRevisionId;
              const isGeneratingThis = generating === lease.id;
              const isValidatingThis = validating === lease.pendingRevisionId;
              const isRejectingThis = rejecting === lease.pendingRevisionId;
              const preview = previewRevision(lease);
              const blockReason = getRevisionBlockReason(lease);
              const canRevise =
                !isPending &&
                (lease.statusVariant === "destructive" ||
                  lease.statusVariant === "warning");

              return (
                <tr
                  key={lease.id}
                  className={
                    isPending
                      ? "bg-blue-50/50 dark:bg-blue-950/10"
                      : lease.statusVariant === "destructive"
                        ? "bg-red-50/30 dark:bg-red-950/10"
                        : lease.statusVariant === "warning"
                          ? "bg-amber-50/30 dark:bg-amber-950/10"
                          : ""
                  }
                >
                  {/* Locataire + Lot (colonne fusionnee) */}
                  <td className="py-3 pl-3">
                    <p className="font-medium text-sm leading-tight">
                      {lease.tenantName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                      {lease.lotLabel}
                    </p>
                  </td>

                  {/* Indice */}
                  <td className="py-3 text-center">
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {lease.indexType}
                    </Badge>
                  </td>

                  {/* Loyer */}
                  <td className="py-3 text-right tabular-nums">
                    {isPending && lease.pendingNewRent ? (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(lease.currentRentHT)}
                        </p>
                        <p className="font-semibold text-primary text-sm">
                          {formatCurrency(lease.pendingNewRent)}
                        </p>
                      </div>
                    ) : (
                      <span className="font-medium">
                        {formatCurrency(lease.currentRentHT)}
                      </span>
                    )}
                  </td>

                  {/* Indice de base */}
                  <td className="py-3 text-center tabular-nums text-muted-foreground hidden md:table-cell">
                    {lease.baseIndexValue ? (
                      <div>
                        <span className="font-medium text-foreground">
                          {lease.baseIndexValue.toFixed(2)}
                        </span>
                        {lease.baseIndexQuarter && (
                          <span className="text-[10px] block">
                            {lease.baseIndexQuarter}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span
                        className="text-[var(--color-status-negative)] font-medium inline-flex items-center justify-center gap-1 cursor-help"
                        title="Modifiez le bail pour definir l'indice de base"
                      >
                        <Info className="h-3 w-3" />
                        Non defini
                      </span>
                    )}
                  </td>

                  {/* Date prochaine revision */}
                  <td className="py-3 text-center text-xs font-medium">
                    {formatDate(new Date(lease.nextRevisionDate))}
                  </td>

                  {/* Statut */}
                  <td className="py-3 text-center">
                    {isPending ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] gap-1 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                      >
                        <Clock className="h-3 w-3" />
                        En attente
                      </Badge>
                    ) : (
                      <Badge
                        variant={
                          lease.statusVariant === "warning"
                            ? "secondary"
                            : lease.statusVariant
                        }
                        className={`text-[10px] gap-1 ${
                          lease.statusVariant === "warning"
                            ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] border-[var(--color-status-caution)]/30"
                            : ""
                        }`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {lease.statusLabel}
                      </Badge>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 text-right pr-3">
                    {isPending ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--color-status-positive)] hover:bg-[var(--color-status-positive)]/10"
                          onClick={() => handleValidate(lease)}
                          disabled={!!isValidatingThis}
                          title="Valider la revision"
                        >
                          {isValidatingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--color-status-negative)] hover:bg-[var(--color-status-negative)]/10"
                          onClick={() => handleReject(lease)}
                          disabled={!!isRejectingThis}
                          title="Rejeter la revision"
                        >
                          {isRejectingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ) : canRevise ? (
                      <div className="flex items-center justify-end gap-1">
                        {lease.missedYears > 1 ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleCatchUp(lease)}
                            disabled={catchingUp === lease.id || generatingAll}
                            title={`Rattraper ${lease.missedYears} années de révision`}
                          >
                            {catchingUp === lease.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            Rattraper ({lease.missedYears} ans)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => handleGenerate(lease)}
                            disabled={isGeneratingThis || generatingAll}
                            title={
                              blockReason
                                ? blockReason
                                : preview
                                  ? `Nouveau loyer estime : ${formatCurrency(preview.newRent)}`
                                  : "Generer la revision"
                            }
                          >
                            {isGeneratingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            Reviser
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Pas encore
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info formule pour les revisions en attente */}
      {pendingRevisions.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-xs space-y-1.5 mt-4">
          <p className="font-medium text-blue-700 dark:text-blue-400">
            Formule de calcul des revisions en attente :
          </p>
          {pendingRevisions.map((l) => (
            <p
              key={l.id}
              className="text-blue-600 dark:text-blue-300 font-mono"
            >
              <span className="font-sans font-medium">{l.tenantName}</span>{" "}
              &mdash; {l.pendingFormula}
            </p>
          ))}
        </div>
      )}

      {/* Dialogs de confirmation */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <DialogContent>
          {confirmDialog?.type === "generate" && confirmDialog.lease && (
            <>
              <DialogHeader>
                <DialogTitle>Generer la revision de loyer</DialogTitle>
                <DialogDescription>
                  Bail de{" "}
                  <strong>{confirmDialog.lease.tenantName}</strong> &mdash;{" "}
                  {confirmDialog.lease.lotLabel}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Loyer actuel :</span>
                  <span className="font-semibold">
                    {formatCurrency(confirmDialog.lease.currentRentHT)} HT
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Nouveau loyer propose :
                  </span>
                  <span className="font-semibold text-primary text-lg">
                    {formatCurrency(confirmDialog.newRent ?? 0)} HT
                  </span>
                </div>
                <div className="text-xs font-mono bg-muted rounded-md p-2.5">
                  {confirmDialog.formula}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  La revision sera creee en attente de validation. Le loyer ne
                  sera modifie qu&apos;apres votre validation explicite.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog(null)}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => confirmGenerate(confirmDialog.lease!)}
                  className="gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  Generer la revision
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "generateAll" && (
            <>
              <DialogHeader>
                <DialogTitle>Generer toutes les revisions</DialogTitle>
                <DialogDescription>
                  {eligibleForGeneration.length}{" "}
                  {eligibleForGeneration.length > 1 ? "baux seront révisés" : "bail sera révisé"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2 max-h-[300px] overflow-y-auto">
                {eligibleForGeneration.map((l) => {
                  const p = previewRevision(l);
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{l.tenantName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {l.lotLabel}
                        </p>
                      </div>
                      {p && (
                        <div className="flex items-center gap-1.5 text-xs tabular-nums shrink-0 ml-3">
                          <span className="text-muted-foreground">
                            {formatCurrency(l.currentRentHT)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="font-semibold text-primary">
                            {formatCurrency(p.newRent)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Toutes les revisions seront creees en attente de validation.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog(null)}
                >
                  Annuler
                </Button>
                <Button onClick={confirmGenerateAll} className="gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Generer toutes les revisions
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "validate" && confirmDialog.lease && (
            <>
              <DialogHeader>
                <DialogTitle>Valider la revision</DialogTitle>
                <DialogDescription>
                  Confirmer la revision du loyer pour{" "}
                  <strong>{confirmDialog.lease.tenantName}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ancien loyer :</span>
                  <span>
                    {formatCurrency(confirmDialog.lease.currentRentHT)} HT
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Nouveau loyer :
                  </span>
                  <span className="font-semibold text-primary text-lg">
                    {formatCurrency(confirmDialog.lease.pendingNewRent ?? 0)} HT
                  </span>
                </div>
                {confirmDialog.lease.pendingFormula && (
                  <div className="text-xs font-mono bg-muted rounded-md p-2.5">
                    {confirmDialog.lease.pendingFormula}
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Le loyer du bail sera immediatement mis a jour.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog(null)}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => confirmValidate(confirmDialog.lease!)}
                  className="bg-[var(--color-status-positive)] hover:bg-[var(--color-status-positive)]/90 gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Valider
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "reject" && confirmDialog.lease && (
            <>
              <DialogHeader>
                <DialogTitle>Rejeter la revision</DialogTitle>
                <DialogDescription>
                  Annuler la revision proposee pour{" "}
                  <strong>{confirmDialog.lease.tenantName}</strong>
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                La proposition de revision sera supprimee. Le loyer reste
                inchange a{" "}
                {formatCurrency(confirmDialog.lease.currentRentHT)} HT.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog(null)}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmReject(confirmDialog.lease!)}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Rejeter
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "catchUp" && confirmDialog.lease && catchUpPreview && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Rattraper les revisions de loyer
                </DialogTitle>
                <DialogDescription>
                  <strong>{confirmDialog.lease.tenantName}</strong> &mdash;{" "}
                  {confirmDialog.lease.lotLabel}
                  <br />
                  {catchUpPreview.steps.length} année{catchUpPreview.steps.length > 1 ? "s" : ""} de révision chaînée{catchUpPreview.steps.length > 1 ? "s" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
                {catchUpPreview.steps.map((step, i) => (
                  <div
                    key={step.year}
                    className="rounded-md border p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Année {i + 1}/{catchUpPreview.steps.length} — T{step.quarter} {step.year}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs tabular-nums">
                        <span className="text-muted-foreground">
                          {formatCurrency(step.rentBefore)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-primary" />
                        <span className="font-semibold text-primary">
                          {formatCurrency(step.rentAfter)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {step.rentBefore.toFixed(2)} × ({step.toIndex.toFixed(2)} / {step.fromIndex.toFixed(2)}) = {step.rentAfter.toFixed(2)}
                    </p>
                  </div>
                ))}

                {/* Résultat final */}
                <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Loyer final :</span>
                    <span className="font-bold text-primary text-lg">
                      {formatCurrency(catchUpPreview.finalRent)} HT
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Indice de base mis à jour : {catchUpPreview.finalIndexValue.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Toutes les révisions intermédiaires seront créées et validées automatiquement.
                Le loyer et l&apos;indice de base du bail seront mis à jour.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmDialog(null);
                    setCatchUpPreview(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => confirmCatchUp(confirmDialog.lease!)}
                  disabled={catchingUp === confirmDialog.lease?.id}
                  className="gap-1.5"
                >
                  {catchingUp === confirmDialog.lease?.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Appliquer le rattrapage
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
