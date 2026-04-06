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
  Building2,
  CalendarClock,
  Play,
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createManualRevision, validateRevision, rejectRevision } from "@/actions/rent-revision";

// ── Types ─────────────────────────────────────────────────────────────

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

// ── Composant principal ───────────────────────────────────────────────

export function RevisionActions({ societyId, leases, latestIndices }: RevisionActionsProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "generate" | "validate" | "reject" | "generateAll";
    lease?: LeaseRevisionData;
    newRent?: number;
    formula?: string;
  } | null>(null);

  const indexMap = new Map(latestIndices.map((i) => [i.type, i]));

  // Baux éligibles (date dépassée ou dans 30j, pas de révision en attente)
  const eligibleForGeneration = leases.filter(
    (l) => !l.pendingRevisionId && (l.statusVariant === "destructive" || l.statusVariant === "warning")
  );

  // Baux avec révision en attente
  const pendingRevisions = leases.filter((l) => l.pendingRevisionId);

  function previewRevision(lease: LeaseRevisionData): { newRent: number; formula: string } | null {
    const idx = indexMap.get(lease.indexType);
    if (!idx || !lease.baseIndexValue) return null;
    const newRent = Math.round((lease.currentRentHT * (idx.value / lease.baseIndexValue)) * 100) / 100;
    const formula = `${lease.currentRentHT.toFixed(2)} × (${idx.value} / ${lease.baseIndexValue}) = ${newRent.toFixed(2)}`;
    return { newRent, formula };
  }

  async function handleGenerate(lease: LeaseRevisionData) {
    const idx = indexMap.get(lease.indexType);
    if (!idx) { toast.error(`Aucun indice ${lease.indexType} disponible`); return; }
    if (!lease.baseIndexValue) { toast.error("Pas de valeur d'indice de base sur ce bail"); return; }

    const preview = previewRevision(lease);
    if (!preview) return;

    setConfirmDialog({ type: "generate", lease, newRent: preview.newRent, formula: preview.formula });
  }

  async function confirmGenerate(lease: LeaseRevisionData) {
    const idx = indexMap.get(lease.indexType);
    if (!idx) return;

    setGenerating(lease.id);
    setConfirmDialog(null);

    const result = await createManualRevision(societyId, {
      leaseId: lease.id,
      effectiveDate: new Date().toISOString(),
      newIndexValue: idx.value,
    });

    setGenerating(null);
    if (result.success) {
      toast.success("Révision générée — en attente de validation");
    } else {
      toast.error(result.error ?? "Erreur lors de la génération");
    }
  }

  async function handleGenerateAll() {
    setConfirmDialog({ type: "generateAll" });
  }

  async function confirmGenerateAll() {
    setGeneratingAll(true);
    setConfirmDialog(null);

    let success = 0;
    let errors = 0;

    for (const lease of eligibleForGeneration) {
      const idx = indexMap.get(lease.indexType);
      if (!idx || !lease.baseIndexValue) { errors++; continue; }

      const result = await createManualRevision(societyId, {
        leaseId: lease.id,
        effectiveDate: new Date().toISOString(),
        newIndexValue: idx.value,
      });

      if (result.success) success++;
      else errors++;
    }

    setGeneratingAll(false);
    if (success > 0) toast.success(`${success} révision${success > 1 ? "s" : ""} générée${success > 1 ? "s" : ""}`);
    if (errors > 0) toast.error(`${errors} erreur${errors > 1 ? "s" : ""}`);
  }

  async function handleValidate(lease: LeaseRevisionData) {
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
      toast.success(`Loyer mis à jour : ${formatCurrency(result.data!.newRentHT)} HT`);
    } else {
      toast.error(result.error ?? "Erreur lors de la validation");
    }
  }

  async function handleReject(lease: LeaseRevisionData) {
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
      toast.success("Révision annulée");
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  const StatusIcon = (variant: string) => {
    if (variant === "destructive") return AlertTriangle;
    if (variant === "warning") return Clock;
    if (variant === "secondary") return CalendarClock;
    return CheckCircle2;
  };

  return (
    <>
      {/* Bouton Générer toutes les révisions */}
      {eligibleForGeneration.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{eligibleForGeneration.length} bail{eligibleForGeneration.length > 1 ? "x" : ""} éligible{eligibleForGeneration.length > 1 ? "s" : ""} à une révision</p>
            <p className="text-xs text-muted-foreground">Générer les propositions de révision en un clic</p>
          </div>
          <Button onClick={handleGenerateAll} disabled={generatingAll} className="gap-2">
            {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer {eligibleForGeneration.length > 1 ? "toutes les " : "la "}révision{eligibleForGeneration.length > 1 ? "s" : ""}
          </Button>
        </div>
      )}

      {/* Tableau des baux */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="pb-2 text-left font-medium">Locataire</th>
              <th className="pb-2 text-left font-medium">Lot</th>
              <th className="pb-2 text-center font-medium">Indice</th>
              <th className="pb-2 text-right font-medium">Loyer actuel HT</th>
              <th className="pb-2 text-center font-medium">Base indice</th>
              <th className="pb-2 text-center font-medium">Prochaine révision</th>
              <th className="pb-2 text-center font-medium">Statut</th>
              <th className="pb-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leases.map((lease) => {
              const Icon = StatusIcon(lease.statusVariant);
              const isPending = !!lease.pendingRevisionId;
              const isGenerating = generating === lease.id;
              const isValidatingThis = validating === lease.pendingRevisionId;
              const isRejectingThis = rejecting === lease.pendingRevisionId;
              const preview = previewRevision(lease);

              return (
                <tr key={lease.id} className={
                  isPending ? "bg-blue-50/50 dark:bg-blue-950/10" :
                  lease.statusVariant === "destructive" ? "bg-red-50/50 dark:bg-red-950/10" :
                  lease.statusVariant === "warning" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                }>
                  <td className="py-2.5 font-medium">{lease.tenantName}</td>
                  <td className="py-2.5 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[200px]">{lease.lotLabel}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    <Badge variant="outline" className="text-[10px]">{lease.indexType}</Badge>
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium">
                    {isPending && lease.pendingNewRent ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground line-through text-xs">{formatCurrency(lease.currentRentHT)}</span>
                        <ArrowRight className="h-3 w-3 text-primary" />
                        <span className="text-primary font-semibold">{formatCurrency(lease.pendingNewRent)}</span>
                      </div>
                    ) : (
                      formatCurrency(lease.currentRentHT)
                    )}
                  </td>
                  <td className="py-2.5 text-center tabular-nums text-muted-foreground">
                    {lease.baseIndexValue?.toFixed(2) ?? "—"}
                    {lease.baseIndexQuarter && (
                      <span className="text-[10px] ml-1">({lease.baseIndexQuarter})</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center font-medium">
                    {formatDate(new Date(lease.nextRevisionDate))}
                  </td>
                  <td className="py-2.5 text-center">
                    {isPending ? (
                      <Badge variant="secondary" className="text-[10px] gap-1 bg-blue-100 text-blue-700 border-blue-200">
                        <Clock className="h-3 w-3" />
                        En attente
                      </Badge>
                    ) : (
                      <Badge
                        variant={lease.statusVariant === "warning" ? "secondary" : lease.statusVariant}
                        className={`text-[10px] gap-1 ${lease.statusVariant === "warning" ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] border-[var(--color-status-caution)]/30" : ""}`}
                      >
                        <Icon className="h-3 w-3" />
                        {lease.statusLabel}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {isPending ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--color-status-positive)] hover:bg-[var(--color-status-positive)]/10"
                          onClick={() => handleValidate(lease)}
                          disabled={!!isValidatingThis}
                          title="Valider la révision"
                        >
                          {isValidatingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-[var(--color-status-negative)] hover:bg-[var(--color-status-negative)]/10"
                          onClick={() => handleReject(lease)}
                          disabled={!!isRejectingThis}
                          title="Rejeter la révision"
                        >
                          {isRejectingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ) : (lease.statusVariant === "destructive" || lease.statusVariant === "warning") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleGenerate(lease)}
                        disabled={isGenerating || !preview}
                        title={preview ? `Nouveau loyer estimé : ${formatCurrency(preview.newRent)}` : "Indice non disponible"}
                      >
                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        Réviser
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info formule pour les révisions en attente */}
      {pendingRevisions.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs space-y-1">
          <p className="font-medium text-blue-700">Révisions en attente de validation :</p>
          {pendingRevisions.map((l) => (
            <p key={l.id} className="text-blue-600 font-mono">
              {l.tenantName} : {l.pendingFormula}
            </p>
          ))}
        </div>
      )}

      {/* Dialogs de confirmation */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent>
          {confirmDialog?.type === "generate" && confirmDialog.lease && (
            <>
              <DialogHeader>
                <DialogTitle>Générer la révision de loyer</DialogTitle>
                <DialogDescription>
                  Bail de <strong>{confirmDialog.lease.tenantName}</strong> — {confirmDialog.lease.lotLabel}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Loyer actuel :</span>
                  <span className="font-semibold">{formatCurrency(confirmDialog.lease.currentRentHT)} HT</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Nouveau loyer :</span>
                  <span className="font-semibold text-primary">{formatCurrency(confirmDialog.newRent ?? 0)} HT</span>
                </div>
                <div className="text-xs font-mono bg-muted rounded p-2">
                  {confirmDialog.formula}
                </div>
                <p className="text-xs text-muted-foreground">
                  La révision sera créée en attente de validation. Le loyer ne sera modifié qu&apos;après votre validation.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>Annuler</Button>
                <Button onClick={() => confirmGenerate(confirmDialog.lease!)}>Générer la révision</Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "generateAll" && (
            <>
              <DialogHeader>
                <DialogTitle>Générer toutes les révisions</DialogTitle>
                <DialogDescription>
                  {eligibleForGeneration.length} bail{eligibleForGeneration.length > 1 ? "x" : ""} seront révisé{eligibleForGeneration.length > 1 ? "s" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2 max-h-[300px] overflow-y-auto">
                {eligibleForGeneration.map((l) => {
                  const p = previewRevision(l);
                  return (
                    <div key={l.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{l.tenantName}</p>
                        <p className="text-xs text-muted-foreground">{l.lotLabel}</p>
                      </div>
                      {p && (
                        <div className="flex items-center gap-1 text-xs tabular-nums">
                          <span>{formatCurrency(l.currentRentHT)}</span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="font-semibold text-primary">{formatCurrency(p.newRent)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Toutes les révisions seront créées en attente de validation.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>Annuler</Button>
                <Button onClick={confirmGenerateAll}>Générer toutes les révisions</Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "validate" && confirmDialog.lease && (
            <>
              <DialogHeader>
                <DialogTitle>Valider la révision</DialogTitle>
                <DialogDescription>
                  Confirmer la révision du loyer pour <strong>{confirmDialog.lease.tenantName}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Ancien loyer :</span>
                  <span>{formatCurrency(confirmDialog.lease.currentRentHT)} HT</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Nouveau loyer :</span>
                  <span className="font-semibold text-primary">{formatCurrency(confirmDialog.lease.pendingNewRent ?? 0)} HT</span>
                </div>
                {confirmDialog.lease.pendingFormula && (
                  <div className="text-xs font-mono bg-muted rounded p-2">
                    {confirmDialog.lease.pendingFormula}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Le loyer du bail sera immédiatement mis à jour.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>Annuler</Button>
                <Button onClick={() => confirmValidate(confirmDialog.lease!)} className="bg-[var(--color-status-positive)] hover:bg-[var(--color-status-positive)]/90">
                  <Check className="h-4 w-4" />Valider
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmDialog?.type === "reject" && confirmDialog.lease && (
            <>
              <DialogHeader>
                <DialogTitle>Rejeter la révision</DialogTitle>
                <DialogDescription>
                  Annuler la révision proposée pour <strong>{confirmDialog.lease.tenantName}</strong>
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                La proposition de révision sera supprimée. Le loyer reste inchangé à {formatCurrency(confirmDialog.lease.currentRentHT)} HT.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>Annuler</Button>
                <Button variant="destructive" onClick={() => confirmReject(confirmDialog.lease!)}>
                  <X className="h-4 w-4" />Rejeter
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
