"use client";

import { Sheet, SheetContent, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, Printer, X, Zap } from "lucide-react";
import type { InvoicePreview } from "@/actions/invoice";

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: InvoicePreview;
  onConfirm?: () => void;
  confirmLabel?: string;
  isConfirming?: boolean;
};

export function InvoicePreviewSheet({
  open,
  onOpenChange,
  preview,
  onConfirm,
  confirmLabel = "Confirmer et générer",
  isConfirming = false,
}: Props) {
  const s = preview.society;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 print:hidden">
          <SheetTitle className="text-base font-semibold">
            Aperçu de la facture
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
            {onConfirm && (
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={isConfirming || preview.alreadyExists}
              >
                <Zap className="h-4 w-4" />
                {isConfirming ? "Génération…" : confirmLabel}
              </Button>
            )}
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Button>
            </SheetClose>
          </div>
        </div>

        {/* Avertissement doublon */}
        {preview.alreadyExists && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Une facture existe déjà pour ce bail sur cette période. La génération sera ignorée.
          </div>
        )}

        {/* Document facture — zone scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="bg-white text-black rounded-lg border shadow-sm p-8 space-y-6 text-sm print:shadow-none print:border-none">
            {/* En-tête émetteur + titre */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                {s?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt="Logo" className="h-14 object-contain mb-2" />
                )}
                <p className="font-bold text-base">{s?.name ?? "—"}</p>
                {s?.addressLine1 && <p className="text-gray-600">{s.addressLine1}</p>}
                {s?.addressLine2 && <p className="text-gray-600">{s.addressLine2}</p>}
                {(s?.postalCode || s?.city) && (
                  <p className="text-gray-600">{[s.postalCode, s.city].filter(Boolean).join(" ")}</p>
                )}
                {s?.siret && <p className="text-gray-500 text-xs">SIRET : {s.siret}</p>}
                {s?.vatNumber && <p className="text-gray-500 text-xs">N° TVA : {s.vatNumber}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="text-2xl font-bold">FACTURE</p>
                <p className="text-xs text-gray-500">Émission : {fmtDate(preview.issueDate)}</p>
                <p className="text-xs text-gray-500">Échéance : {fmtDate(preview.dueDate)}</p>
                <p className="text-xs text-gray-500 font-medium">{preview.periodLabel}</p>
              </div>
            </div>

            {/* Destinataire */}
            <div className="rounded border border-gray-200 p-3 bg-gray-50 max-w-xs">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Destinataire</p>
              <p className="font-semibold">{preview.tenantName}</p>
              {preview.tenantAddress ? (
                <p className="text-xs text-gray-600 whitespace-pre-line mt-0.5">{preview.tenantAddress}</p>
              ) : (
                <p className="text-xs text-gray-400 italic mt-0.5">Adresse non renseignée</p>
              )}
              {preview.tenantEmail && <p className="text-xs text-gray-600 mt-0.5">{preview.tenantEmail}</p>}
              {preview.tenantPhone && <p className="text-xs text-gray-600">{preview.tenantPhone}</p>}
            </div>

            {/* Objet */}
            <p className="font-medium">
              Objet : Appel de loyer
              <span className="text-gray-600 font-normal"> — {preview.lotLabel}</span>
            </p>

            {/* Lignes */}
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 border border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Désignation</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">HT</th>
                  <th className="text-right px-3 py-2 font-semibold w-16">TVA %</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">TTC</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border-b border-gray-100">{line.label}</td>
                    <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums">
                      {fmt(line.totalHT)}
                    </td>
                    <td className="px-3 py-2 text-right border-b border-gray-100 text-gray-500">
                      {line.vatRate} %
                    </td>
                    <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums font-medium">
                      {fmt(line.totalTTC)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux */}
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total HT</span>
                  <span className="tabular-nums">{fmt(preview.totalHT)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">TVA</span>
                  <span className="tabular-nums">{fmt(preview.totalVAT)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-2">
                  <span>Total TTC</span>
                  <span className="tabular-nums">{fmt(preview.totalTTC)}</span>
                </div>
              </div>
            </div>

            {/* Mentions légales */}
            <div className="border-t border-gray-200 pt-4 space-y-1 text-xs text-gray-500">
              {s?.vatRegime === "FRANCHISE" && (
                <p className="font-medium text-gray-700">TVA non applicable — article 293 B du CGI</p>
              )}
              <p>
                En cas de retard de paiement, des pénalités de retard sont exigibles au taux de 3 fois
                le taux d&apos;intérêt légal, ainsi qu&apos;une indemnité forfaitaire de recouvrement de
                40 € (art. D. 441-5 C. com.).
              </p>
              {s?.legalMentions && (
                <p className="whitespace-pre-wrap">{s.legalMentions}</p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
