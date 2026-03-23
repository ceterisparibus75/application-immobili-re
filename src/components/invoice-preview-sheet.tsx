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

  // Récap TVA par taux
  const vatBreakdown = preview.lines.reduce<Record<number, { ht: number; vat: number }>>((acc, l) => {
    if (!acc[l.vatRate]) acc[l.vatRate] = { ht: 0, vat: 0 };
    acc[l.vatRate].ht += l.totalHT;
    acc[l.vatRate].vat += l.totalVAT;
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 print:hidden">
          <SheetTitle className="text-base font-semibold">Aperçu de la facture</SheetTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
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
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Une facture existe déjà pour ce bail sur cette période.
          </div>
        )}

        {/* Document — zone scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white text-gray-900 rounded-lg border shadow text-sm print:shadow-none print:border-none">

            {/* Bandeau supérieur */}
            <div className="bg-gray-900 text-white px-8 py-5 rounded-t-lg flex items-center justify-between">
              <div>
                {s?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logoUrl} alt="Logo" className="h-10 object-contain brightness-0 invert" />
                ) : (
                  <p className="text-lg font-bold tracking-wide">{s?.name ?? "—"}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold tracking-widest">FACTURE</p>
                <p className="text-gray-300 text-xs mt-0.5">{preview.periodLabel}</p>
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Émetteur / Destinataire */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">De</p>
                  <p className="font-bold">{s?.name ?? "—"}</p>
                  {s?.addressLine1 && <p className="text-gray-600 text-xs">{s.addressLine1}</p>}
                  {s?.addressLine2 && <p className="text-gray-600 text-xs">{s.addressLine2}</p>}
                  {(s?.postalCode || s?.city) && (
                    <p className="text-gray-600 text-xs">{[s.postalCode, s.city].filter(Boolean).join(" ")}</p>
                  )}
                  {s?.siret && <p className="text-gray-400 text-xs mt-1">SIRET : {s.siret}</p>}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">À</p>
                  <p className="font-bold">{preview.tenantName}</p>
                  {preview.tenantAddress ? (
                    <p className="text-gray-600 text-xs whitespace-pre-line">{preview.tenantAddress}</p>
                  ) : (
                    <p className="text-gray-400 italic text-xs">Adresse non renseignée</p>
                  )}
                  {preview.tenantEmail && <p className="text-gray-600 text-xs">{preview.tenantEmail}</p>}
                  {preview.tenantPhone && <p className="text-gray-600 text-xs">{preview.tenantPhone}</p>}
                </div>
              </div>

              {/* Méta */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg px-5 py-3 text-xs">
                <div>
                  <p className="text-gray-400 uppercase tracking-wide">Émission</p>
                  <p className="font-semibold mt-0.5">{fmtDate(preview.issueDate)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide">Échéance</p>
                  <p className="font-semibold mt-0.5">{fmtDate(preview.dueDate)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-wide">Période</p>
                  <p className="font-semibold mt-0.5 capitalize">{preview.periodLabel}</p>
                </div>
              </div>

              {/* Objet */}
              <p className="font-semibold text-gray-700 text-sm">
                Objet : Appel de loyer
                <span className="font-normal text-gray-500"> — {preview.lotLabel}</span>
              </p>

              {/* Lignes */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-900 text-left">
                    <th className="pb-2 font-semibold text-gray-700">Désignation</th>
                    <th className="pb-2 font-semibold text-gray-700 text-right w-16">TVA</th>
                    <th className="pb-2 font-semibold text-gray-700 text-right w-24">HT</th>
                    <th className="pb-2 font-semibold text-gray-700 text-right w-24">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                      <td className="py-2 pr-3">{line.label}</td>
                      <td className="py-2 text-right text-gray-500">{line.vatRate} %</td>
                      <td className="py-2 text-right tabular-nums">{fmt(line.totalHT)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmt(line.totalTTC)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totaux */}
              <div className="flex justify-end">
                <div className="w-56 space-y-1 text-xs">
                  {Object.entries(vatBreakdown).map(([rate, vals]) => (
                    <div key={rate} className="flex justify-between text-gray-600">
                      <span>TVA {rate} %</span>
                      <span className="tabular-nums">{fmt(vals.vat)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-gray-600">
                    <span>Total HT</span>
                    <span className="tabular-nums font-medium">{fmt(preview.totalHT)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t-2 border-gray-900 pt-1.5 mt-1">
                    <span>Total TTC</span>
                    <span className="tabular-nums">{fmt(preview.totalTTC)}</span>
                  </div>
                </div>
              </div>

              {/* Mentions légales */}
              <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 space-y-1">
                {s?.vatRegime === "FRANCHISE" && (
                  <p className="font-semibold text-gray-600">TVA non applicable — art. 293 B du CGI</p>
                )}
                <p>Pénalités de retard : 3× taux légal + indemnité forfaitaire 40 € (art. D. 441-5 C. com.).</p>
                {s?.legalMentions && <p className="whitespace-pre-wrap">{s.legalMentions}</p>}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
