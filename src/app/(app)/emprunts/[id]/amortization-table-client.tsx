"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle } from "lucide-react";
import { markAmortizationLinePaid } from "@/actions/loan";

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
};

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
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

  function togglePaid(line: Line) {
    setLoadingId(line.id);
    startTransition(async () => {
      const result = await markAmortizationLinePaid(societyId, line.id, !line.isPaid);
      if ("success" in result) {
        setLocalLines((prev) =>
          prev.map((l) =>
            l.id === line.id
              ? { ...l, isPaid: !l.isPaid, paidAt: !l.isPaid ? new Date().toISOString() : null }
              : l
          )
        );
      }
      setLoadingId(null);
    });
  }

  // Résumé cumulé
  const totalPrincipal = localLines.reduce((s, l) => s + l.principalPayment, 0);
  const totalInterest = localLines.reduce((s, l) => s + l.interestPayment, 0);
  const totalInsurance = localLines.reduce((s, l) => s + l.insurancePayment, 0);
  const totalPayment = localLines.reduce((s, l) => s + l.totalPayment, 0);

  // Afficher max 24 lignes par défaut, avec "voir tout"
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
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleLines.map((line) => {
              const isLoading = loadingId === line.id && isPending;
              return (
                <tr
                  key={line.id}
                  className={`transition-colors ${line.isPaid ? "text-muted-foreground bg-muted/30" : ""}`}
                >
                  <td className="py-1.5 pr-2 tabular-nums">{line.period}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {new Date(line.dueDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(line.principalPayment)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-amber-600">{fmt(line.interestPayment)}</td>
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
                      title={line.isPaid ? "Marquer comme non réglée" : "Marquer comme réglée"}
                    >
                      {line.isPaid ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totaux */}
          <tfoot>
            <tr className="border-t font-semibold text-xs">
              <td colSpan={2} className="pt-2 pr-2">Total</td>
              <td className="pt-2 pr-2 text-right tabular-nums">{fmt(totalPrincipal)}</td>
              <td className="pt-2 pr-2 text-right tabular-nums text-amber-600">{fmt(totalInterest)}</td>
              {totalInsurance > 0 && <td className="pt-2 pr-2 text-right tabular-nums text-muted-foreground">{fmt(totalInsurance)}</td>}
              <td className="pt-2 pr-2 text-right tabular-nums">{fmt(totalPayment)}</td>
              <td className="pt-2 pr-2 text-right tabular-nums text-muted-foreground">—</td>
              <td className="pt-2">
                <Badge variant="secondary" className="text-xs">
                  {localLines.filter((l) => l.isPaid).length}/{localLines.length}
                </Badge>
              </td>
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
