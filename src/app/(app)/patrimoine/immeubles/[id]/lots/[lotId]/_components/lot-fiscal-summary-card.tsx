import { AlertTriangle, FileText, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FiscalBeneficiaryLine, LotFiscalSummary } from "@/lib/lot-fiscal-summary";

const ROLE_LABEL: Record<FiscalBeneficiaryLine["role"], string> = {
  PLEIN_PROPRIETAIRE: "Plein propriétaire",
  USUFRUITIER: "Usufruitier",
  NU_PROPRIETAIRE: "Nu-propriétaire",
};

function fmt(amount: number): string {
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function LotFiscalSummaryCard({ summary }: { summary: LotFiscalSummary }) {
  if (!summary.hasOwnershipData && summary.notes.length === 0) return null;

  const hasWarning = summary.notes.some((n) => n.level === "warning");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Synthèse fiscale {summary.year} — Formulaire 2044
          </span>
          {summary.isDismembered && (
            <Badge variant="outline" className="text-xs font-normal">
              Démembrement
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.byBeneficiary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Déclarant</th>
                  <th className="pb-2 font-normal">Rôle</th>
                  <th className="pb-2 font-normal text-right">Recettes {summary.year}</th>
                </tr>
              </thead>
              <tbody>
                {summary.byBeneficiary.map((line) => (
                  <tr key={line.proprietaireId} className="border-b last:border-b-0">
                    <td className="py-2 font-medium">{line.proprietaireLabel}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {ROLE_LABEL[line.role]}
                    </td>
                    <td className="py-2 text-right">{fmt(line.recettes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summary.maintenanceCount > 0 && (
          <div className="rounded-md bg-muted/50 p-2.5 text-xs">
            <span className="font-medium text-foreground">Maintenance enregistrée :</span>{" "}
            <span className="text-muted-foreground">
              {summary.maintenanceCount} opération(s), total {fmt(summary.maintenanceCostTotal)}
            </span>
          </div>
        )}

        {summary.notes.length > 0 && (
          <ul className="space-y-1.5">
            {summary.notes.map((note, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 text-xs ${
                  note.level === "warning"
                    ? "text-amber-700 dark:text-amber-500"
                    : "text-muted-foreground"
                }`}
              >
                {note.level === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : (
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                <span>{note.text}</span>
              </li>
            ))}
          </ul>
        )}

        {!hasWarning && (
          <p className="text-[11px] text-muted-foreground pt-1">
            Synthèse indicative — à valider avec votre conseiller fiscal. Le module
            n&apos;intègre pas encore les charges au niveau immeuble (clés de
            répartition).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
