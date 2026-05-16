"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getAllocationContextForTransaction,
  reconcileTransactionWithAllocations,
  type AllocationContext,
} from "@/actions/bank-reconciliation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  societyId: string;
  transactionId: string | null;
  onClose: () => void;
}

interface LineSelection {
  selected: boolean;
  amount: number; // montant alloué pour cette ligne
}

const EPSILON = 0.01;

export function AllocationSheet({ societyId, transactionId, onClose }: Props) {
  const router = useRouter();
  const [ctx, setCtx] = useState<AllocationContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Map<string, LineSelection>>(new Map());
  const [creditExcess, setCreditExcess] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!transactionId) {
      setCtx(null);
      return;
    }
    setLoading(true);
    getAllocationContextForTransaction(societyId, transactionId)
      .then((data) => {
        setCtx(data);
        // Pré-sélectionner le premier locataire avec une suggestion exacte
        const tenantWithExact = data?.groups.find((g) =>
          g.suggestions.some((s) => s.delta === 0),
        );
        const initial = tenantWithExact ?? data?.groups[0] ?? null;
        if (initial) {
          setActiveTenantId(initial.tenantId);
          applySuggestionFromGroup(initial);
        } else {
          setActiveTenantId(null);
          setSelections(new Map());
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, societyId]);

  function applySuggestionFromGroup(group: AllocationContext["groups"][number]) {
    const exact = group.suggestions.find((s) => s.delta === 0) ?? group.suggestions[0];
    const map = new Map<string, LineSelection>();
    for (const inv of group.invoices) {
      const selected = !!exact && exact.invoiceIds.includes(inv.id);
      map.set(inv.id, {
        selected,
        amount: selected ? inv.remaining : inv.remaining,
      });
    }
    setSelections(map);
  }

  function selectTenant(tenantId: string) {
    setActiveTenantId(tenantId);
    const group = ctx?.groups.find((g) => g.tenantId === tenantId);
    if (group) applySuggestionFromGroup(group);
  }

  function toggleLine(invoiceId: string) {
    const next = new Map(selections);
    const current = next.get(invoiceId);
    if (current) next.set(invoiceId, { ...current, selected: !current.selected });
    setSelections(next);
  }

  function updateLineAmount(invoiceId: string, value: string) {
    const num = parseFloat(value.replace(",", "."));
    if (Number.isNaN(num)) return;
    const next = new Map(selections);
    const current = next.get(invoiceId);
    if (current) next.set(invoiceId, { ...current, amount: num });
    setSelections(next);
  }

  const activeGroup = ctx?.groups.find((g) => g.tenantId === activeTenantId) ?? null;
  const selectedLines = activeGroup
    ? activeGroup.invoices.filter((inv) => selections.get(inv.id)?.selected)
    : [];
  const totalAllocated = selectedLines.reduce(
    (s, inv) => s + (selections.get(inv.id)?.amount ?? 0),
    0,
  );
  const txAmount = ctx?.remaining ?? 0;
  const delta = round2(txAmount - totalAllocated);
  const isExact = Math.abs(delta) <= EPSILON;
  const isOver = delta < -EPSILON;
  const isUnder = delta > EPSILON;
  const overAmount = isOver ? -delta : 0;

  function handleSubmit() {
    if (!transactionId || !activeGroup) return;
    if (selectedLines.length === 0) {
      toast.error("Sélectionnez au moins une facture");
      return;
    }
    if (isOver) {
      toast.error(
        `Ventilation totale (${totalAllocated.toFixed(2)} €) dépasse le virement (${txAmount.toFixed(2)} €)`,
      );
      return;
    }

    const allocations = selectedLines.map((inv) => ({
      invoiceId: inv.id,
      amount: selections.get(inv.id)!.amount,
    }));

    startTransition(async () => {
      const result = await reconcileTransactionWithAllocations(
        societyId,
        transactionId,
        allocations,
        { creditExcessToTenant: creditExcess },
      );
      if (result.success) {
        const msg = isUnder && creditExcess
          ? `Ventilation OK — avoir de ${delta.toFixed(2)} € crédité sur le locataire`
          : "Virement ventilé avec succès";
        toast.success(msg);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la ventilation");
      }
    });
  }

  return (
    <Sheet open={transactionId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ventiler ce virement</SheetTitle>
          <SheetDescription>
            Répartissez le virement sur une ou plusieurs factures impayées d&apos;un même locataire.
            Un excédent éventuel est porté en avoir sur le locataire.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des candidats…
          </div>
        )}

        {!loading && ctx && (
          <div className="space-y-4 py-4">
            {/* Bandeau récap virement */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">{ctx.transactionLabel}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatDate(ctx.transactionDate)}</span>
                <span>
                  Montant {formatCurrency(ctx.transactionAmount)}
                  {ctx.alreadyAllocated > 0 && (
                    <> · Déjà ventilé {formatCurrency(ctx.alreadyAllocated)}</>
                  )}
                </span>
              </div>
              <p className="text-xs">
                Reste à ventiler :{" "}
                <span className="font-semibold text-foreground">{formatCurrency(ctx.remaining)}</span>
              </p>
            </div>

            {/* Sélecteur de locataire */}
            {ctx.groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun locataire n&apos;a de factures impayées correspondant à ce virement.
              </p>
            ) : (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Locataire
                  </Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {ctx.groups.map((g) => {
                      const hasExact = g.suggestions.some((s) => s.delta === 0);
                      const isActive = g.tenantId === activeTenantId;
                      return (
                        <button
                          key={g.tenantId}
                          onClick={() => selectTenant(g.tenantId)}
                          className={`px-3 py-1.5 rounded-md border text-sm transition ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {g.tenantLabel}
                          {hasExact && (
                            <Sparkles className="inline-block h-3 w-3 ml-1.5" />
                          )}
                          <span className="ml-1.5 text-[10px] opacity-70">
                            ({g.invoices.length})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeGroup && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Factures impayées
                      </Label>
                      {activeGroup.suggestions.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applySuggestionFromGroup(activeGroup)}
                        >
                          <Sparkles className="h-3 w-3" />
                          Re-suggérer
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-md divide-y">
                      {activeGroup.invoices.map((inv) => {
                        const sel = selections.get(inv.id);
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center gap-3 p-2.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={sel?.selected ?? false}
                              onChange={() => toggleLine(inv.id)}
                              className="h-4 w-4"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">
                                {inv.invoiceNumber ?? "(brouillon)"}
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  {inv.invoiceType}
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Échue le {formatDate(inv.dueDate)} ·{" "}
                                {inv.paidSoFar > 0
                                  ? `Reste ${formatCurrency(inv.remaining)} / ${formatCurrency(inv.totalTTC)}`
                                  : `${formatCurrency(inv.totalTTC)}`}
                              </p>
                            </div>
                            {sel?.selected && (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={inv.remaining}
                                value={sel.amount}
                                onChange={(e) => updateLineAmount(inv.id, e.target.value)}
                                className="w-28 text-right"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Récap totaux */}
                    <div className="rounded-md border p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total alloué</span>
                        <span className="font-medium">{formatCurrency(totalAllocated)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Virement</span>
                        <span>{formatCurrency(txAmount)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1 mt-1">
                        {isExact ? (
                          <>
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Somme exacte
                            </span>
                            <span>—</span>
                          </>
                        ) : isOver ? (
                          <>
                            <span className="text-destructive">Excédent (dépassement)</span>
                            <span className="text-destructive">+{formatCurrency(overAmount)}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-amber-700">
                              {creditExcess ? "Trop-perçu (→ avoir locataire)" : "Reste à ventiler"}
                            </span>
                            <span>{formatCurrency(delta)}</span>
                          </>
                        )}
                      </div>

                      {isUnder && (
                        <label className="flex items-center gap-2 text-xs pt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={creditExcess}
                            onChange={(e) => setCreditExcess(e.target.checked)}
                            className="h-3.5 w-3.5"
                          />
                          Créer un avoir sur le locataire pour l&apos;excédent ({formatCurrency(delta)})
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || isOver || selectedLines.length === 0 || !activeGroup}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Valider la ventilation
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
