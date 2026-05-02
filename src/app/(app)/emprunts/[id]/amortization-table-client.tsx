"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Circle, Pencil, Check, X } from "lucide-react";
import { markAmortizationLinePaid, updateAmortizationLine } from "@/actions/loan";
import { toast } from "sonner";

type Line = {
  id: string;
  period: number;
  dueDate: Date | string;
  principalPayment: number;
  interestPayment: number;
  insurancePayment: number;
  totalPayment: number;
  remainingBalance: number;
  isPaid: boolean;
  paidAt: Date | string | null;
  principalPaidAt?: Date | string | null;
  interestPaidAt?: Date | string | null;
  insurancePaidAt?: Date | string | null;
  principalBankTransactionId?: string | null;
  interestBankTransactionId?: string | null;
  insuranceBankTransactionId?: string | null;
};

type EditState = {
  principalPayment: string;
  interestPayment: string;
  insurancePayment: string;
  totalPayment: string;
  remainingBalance: string;
};

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
}

function parseNum(s: string): number {
  return parseFloat(s.replace(",", ".").replace(/\s/g, "")) || 0;
}

function hasPositiveAmount(value: number): boolean {
  return Math.round(value * 100) / 100 > 0.01;
}

function isFullyPointed(line: Line): boolean {
  if (line.isPaid) return true;
  const principalOk = !hasPositiveAmount(line.principalPayment) || Boolean(line.principalPaidAt);
  const interestOk = !hasPositiveAmount(line.interestPayment) || Boolean(line.interestPaidAt);
  const insuranceOk = !hasPositiveAmount(line.insurancePayment) || Boolean(line.insurancePaidAt);
  return principalOk && interestOk && insuranceOk;
}

function isPartiallyPointed(line: Line): boolean {
  if (isFullyPointed(line)) return false;
  return Boolean(line.principalPaidAt || line.interestPaidAt || line.insurancePaidAt);
}

export function AmortizationTableClient({
  lines,
  societyId,
}: {
  lines: Line[];
  societyId: string;
}) {
  const [localLines, setLocalLines] = useState(lines);
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  function togglePaid(line: Line) {
    setLoadingId(line.id);
    startTransition(async () => {
      const result = await markAmortizationLinePaid(societyId, line.id, !line.isPaid);
      if ("success" in result) {
        const paidAt = !line.isPaid ? new Date().toISOString() : null;
        setLocalLines((prev) =>
          prev.map((l) =>
            l.id === line.id
              ? {
                  ...l,
                  isPaid: !l.isPaid,
                  paidAt,
                  principalPaidAt: !l.isPaid
                    ? (hasPositiveAmount(l.principalPayment) ? paidAt : null)
                    : (l.principalBankTransactionId ? l.principalPaidAt : null),
                  interestPaidAt: !l.isPaid
                    ? (hasPositiveAmount(l.interestPayment) ? paidAt : null)
                    : (l.interestBankTransactionId ? l.interestPaidAt : null),
                  insurancePaidAt: !l.isPaid
                    ? (hasPositiveAmount(l.insurancePayment) ? paidAt : null)
                    : (l.insuranceBankTransactionId ? l.insurancePaidAt : null),
                }
              : l
          )
        );
      } else {
        toast.error((result as { error?: string }).error ?? "Erreur lors du marquage");
      }
      setLoadingId(null);
    });
  }

  function startEdit(line: Line) {
    setEditingId(line.id);
    setEditState({
      principalPayment: line.principalPayment.toFixed(2).replace(".", ","),
      interestPayment: line.interestPayment.toFixed(2).replace(".", ","),
      insurancePayment: line.insurancePayment.toFixed(2).replace(".", ","),
      totalPayment: line.totalPayment.toFixed(2).replace(".", ","),
      remainingBalance: line.remainingBalance.toFixed(2).replace(".", ","),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  function saveEdit(line: Line) {
    if (!editState) return;
    setLoadingId(line.id);
    startTransition(async () => {
      const data = {
        principalPayment: parseNum(editState.principalPayment),
        interestPayment: parseNum(editState.interestPayment),
        insurancePayment: parseNum(editState.insurancePayment),
        totalPayment: parseNum(editState.totalPayment),
        remainingBalance: parseNum(editState.remainingBalance),
      };
      const result = await updateAmortizationLine(societyId, line.id, data);
      if ("success" in result) {
        setLocalLines((prev) =>
          prev.map((l) => (l.id === line.id ? { ...l, ...data } : l))
        );
        toast.success("Échéance mise à jour");
        setEditingId(null);
        setEditState(null);
      } else {
        toast.error(result.error ?? "Erreur lors de la mise à jour");
      }
      setLoadingId(null);
    });
  }

  // Résumé cumulé
  const totalPrincipal = localLines.reduce((s, l) => s + l.principalPayment, 0);
  const totalInterest = localLines.reduce((s, l) => s + l.interestPayment, 0);
  const totalInsurance = localLines.reduce((s, l) => s + l.insurancePayment, 0);
  const totalPayment = localLines.reduce((s, l) => s + l.totalPayment, 0);

  const [showAll, setShowAll] = useState(false);
  const visibleLines = showAll ? localLines : localLines.slice(0, 24);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left pb-2 pr-2 font-medium">N°</th>
              <th className="text-left pb-2 pr-2 font-medium">Échéance</th>
              <th className="text-right pb-2 pr-2 font-medium">Capital</th>
              <th className="text-right pb-2 pr-2 font-medium">Intérêts</th>
              {totalInsurance > 0 && <th className="text-right pb-2 pr-2 font-medium">Assurance</th>}
              <th className="text-right pb-2 pr-2 font-medium">Total</th>
              <th className="text-right pb-2 pr-2 font-medium">Restant dû</th>
              <th className="text-center pb-2 font-medium">Réglée</th>
              <th className="text-center pb-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleLines.map((line) => {
              const isLoading = loadingId === line.id && isPending;
              const isEditing = editingId === line.id;
              const isLineFullyPointed = isFullyPointed(line);
              const isLinePartiallyPointed = isPartiallyPointed(line);

              if (isEditing && editState) {
                return (
                  <tr key={line.id} className="bg-blue-50/50">
                    <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{line.period}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">
                      {new Date(line.dueDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </td>
                    <td className="py-1 pr-1">
                      <Input
                        className="h-7 text-right text-xs w-24 tabular-nums"
                        value={editState.principalPayment}
                        onChange={(e) => setEditState({ ...editState, principalPayment: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-1">
                      <Input
                        className="h-7 text-right text-xs w-24 tabular-nums"
                        value={editState.interestPayment}
                        onChange={(e) => setEditState({ ...editState, interestPayment: e.target.value })}
                      />
                    </td>
                    {totalInsurance > 0 && (
                      <td className="py-1 pr-1">
                        <Input
                          className="h-7 text-right text-xs w-24 tabular-nums"
                          value={editState.insurancePayment}
                          onChange={(e) => setEditState({ ...editState, insurancePayment: e.target.value })}
                        />
                      </td>
                    )}
                    <td className="py-1 pr-1">
                      <Input
                        className="h-7 text-right text-xs w-24 tabular-nums font-medium"
                        value={editState.totalPayment}
                        onChange={(e) => setEditState({ ...editState, totalPayment: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-1">
                      <Input
                        className="h-7 text-right text-xs w-28 tabular-nums"
                        value={editState.remainingBalance}
                        onChange={(e) => setEditState({ ...editState, remainingBalance: e.target.value })}
                      />
                    </td>
                    <td className="py-1 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(line)} disabled={isLoading} title="Enregistrer">
                        <Check className="h-4 w-4 text-[var(--color-status-positive)]" />
                      </Button>
                    </td>
                    <td className="py-1 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={isLoading} title="Annuler">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={line.id}
                  className={`transition-colors group ${isLineFullyPointed ? "text-muted-foreground bg-muted/30" : ""}`}
                >
                  <td className="py-1.5 pr-2 tabular-nums">{line.period}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {new Date(line.dueDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(line.principalPayment)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-[var(--color-status-caution)]">{fmt(line.interestPayment)}</td>
                  {totalInsurance > 0 && (
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{fmt(line.insurancePayment)}</td>
                  )}
                  <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{fmt(line.totalPayment)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-destructive">{fmt(line.remainingBalance)}</td>
                  <td className="py-1.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => togglePaid(line)}
                      disabled={isLoading}
                      title={isLineFullyPointed ? "Marquer comme non réglée" : "Marquer comme réglée"}
                    >
                      {isLineFullyPointed ? (
                        <CheckCircle className="h-4 w-4 text-[var(--color-status-positive)]" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    {isLinePartiallyPointed && (
                      <Badge variant="warning" className="ml-1 h-4 px-1 text-[10px]">
                        partiel
                      </Badge>
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => startEdit(line)}
                      disabled={isLoading || !!editingId}
                      title="Modifier les montants"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold text-xs">
              <td colSpan={2} className="pt-2 pr-2">Total</td>
              <td className="pt-2 pr-2 text-right tabular-nums">{fmt(totalPrincipal)}</td>
              <td className="pt-2 pr-2 text-right tabular-nums text-[var(--color-status-caution)]">{fmt(totalInterest)}</td>
              {totalInsurance > 0 && <td className="pt-2 pr-2 text-right tabular-nums text-muted-foreground">{fmt(totalInsurance)}</td>}
              <td className="pt-2 pr-2 text-right tabular-nums">{fmt(totalPayment)}</td>
              <td className="pt-2 pr-2 text-right tabular-nums text-muted-foreground">—</td>
              <td className="pt-2">
                <Badge variant="secondary" className="text-xs">
                  {localLines.filter((l) => isFullyPointed(l)).length}/{localLines.length}
                </Badge>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {!showAll && localLines.length > 24 && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Voir toutes les {localLines.length} échéances
          </Button>
        </div>
      )}
    </div>
  );
}
