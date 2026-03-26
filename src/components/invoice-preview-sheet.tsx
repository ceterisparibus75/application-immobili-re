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
          <SheetTitle className="text-base font-semibold">Aperçu de la facture</SheetTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
            {onConfirm && (
              <Button size="sm" onClick={onConfirm} disabled={isConfirming || preview.alreadyExists}>
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

        {/* Doublon */}
        {preview.alreadyExists && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Une facture existe déjà pour ce bail sur cette période.
          </div>
        )}

        {/* Document — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-white text-gray-900 text-sm font-sans space-y-5">

            {/* Numéro + date */}
            <div className="text-center text-xs text-gray-600">
              <p>Facture n° : <span className="font-semibold text-gray-900">— prévisualisation —</span></p>
              <p>Émise le : {fmtDate(preview.issueDate)}</p>
            </div>

            {/* Émetteur + Destinataire */}
            <div className="flex items-start gap-6">
              <div className="flex-1 space-y-0.5 text-xs">
                {preview.logoResolvedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.logoResolvedUrl} alt="Logo" className="h-12 object-contain mb-2" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : null}
                <p className="font-bold text-sm">{s?.name ?? "—"}</p>
                {s?.addressLine1 && (
                  <p className="text-gray-600">
                    {s.addressLine1}, {[s.postalCode, s.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {s?.siret && <p className="text-gray-500">SIRET : {s.siret}</p>}
              </div>

              {/* Destinataire avec coins + */}
              <div className="w-52 relative p-4 text-xs">
                <span className="absolute top-0.5 left-0.5 text-gray-400 select-none">+</span>
                <span className="absolute top-0.5 right-0.5 text-gray-400 select-none">+</span>
                <span className="absolute bottom-0.5 left-0.5 text-gray-400 select-none">+</span>
                <span className="absolute bottom-0.5 right-0.5 text-gray-400 select-none">+</span>
                <p className="font-semibold text-gray-900">{preview.tenantName}</p>
                {preview.tenantAddress ? (
                  <p className="text-gray-600 whitespace-pre-line">{preview.tenantAddress}</p>
                ) : (
                  <p className="text-gray-400 italic">Adresse non renseignée</p>
                )}
                {preview.tenantEmail && <p className="text-gray-600">{preview.tenantEmail}</p>}
              </div>
            </div>

            {/* Titre */}
            <h2 className="text-lg font-bold">APPEL DE LOYER ET CHARGES</h2>

            {/* Infos */}
            <div className="space-y-0.5 text-xs">
              <p>Date d&apos;échéance : {fmtDate(preview.dueDate)}</p>
              <p>Pour la période : <span className="font-medium capitalize">{preview.periodLabel}</span></p>
              {preview.lotLabel && (
                <>
                  <p>Lot(s) concerné(s) :</p>
                  <p>{preview.lotLabel}</p>
                </>
              )}
            </div>

            {/* Tableau */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-1.5 font-semibold border border-gray-200">Libellé opération</th>
                  <th className="text-right px-2 py-1.5 font-semibold border border-gray-200 w-24">Montant HT</th>
                  <th className="text-right px-2 py-1.5 font-semibold border border-gray-200 w-16">TVA</th>
                  <th className="text-right px-2 py-1.5 font-semibold border border-gray-200 w-24">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line, i) => (
                  <tr key={i} className={i % 2 === 1 ? "bg-gray-50/40" : ""}>
                    <td className="px-2 py-1.5 border-b border-gray-100">
                      <p>{line.label}</p>
                      {preview.lotNumber && <p className="text-gray-400">{preview.lotNumber}</p>}
                    </td>
                    <td className="px-2 py-1.5 text-right border-b border-gray-100 tabular-nums">{fmt(line.totalHT)}</td>
                    <td className="px-2 py-1.5 text-right border-b border-gray-100 text-gray-500">
                      {line.vatRate.toFixed(2).replace(".", ",")} %
                    </td>
                    <td className="px-2 py-1.5 text-right border-b border-gray-100 tabular-nums">{fmt(line.totalTTC)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} />
                  <td className="px-2 py-1.5 text-right text-gray-600 border-t border-gray-200">Total HT</td>
                  <td className="px-2 py-1.5 text-right tabular-nums border-t border-gray-200">{fmt(preview.totalHT)}</td>
                </tr>
                {preview.totalVAT > 0.001 && (
                  <tr>
                    <td colSpan={2} />
                    <td className="px-2 py-1.5 text-right text-gray-600">TVA</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(preview.totalVAT)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} />
                  <td className="px-2 py-1.5 text-right font-bold border-t border-gray-400">TOTAL TTC</td>
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums border-t border-gray-400">{fmt(preview.totalTTC)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Situation de compte */}
            <div className="mt-4">
              <p className="font-bold text-xs mb-1">Situation de compte au {fmtDate(preview.issueDate)}</p>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-1.5">Solde précédent à date d&apos;édition</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                      {preview.previousBalance !== 0
                        ? `${preview.previousBalance > 0 ? "" : "−"} ${fmt(Math.abs(preview.previousBalance))}`
                        : fmt(0)}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td className="border border-gray-200 px-3 py-1.5">
                      Total à payer avant le {fmtDate(preview.dueDate)}
                    </td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">
                      {fmt(Math.max(0, preview.previousBalance + preview.totalTTC))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mentions légales abrégées */}
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-3">
              {s?.vatRegime === "FRANCHISE" && (
                <p className="font-semibold text-gray-700 mb-1">TVA non applicable — art. 293 B du CGI</p>
              )}
              <p>
                Pas d&apos;escompte pour règlement anticipé. En cas de retard de paiement, une pénalité
                égale à 3 fois le taux intérêt légal sera exigible (Art. L 441-10 C. com.).
              </p>
              {s?.legalMentions && <p className="mt-1 whitespace-pre-wrap">{s.legalMentions}</p>}
            </div>

            {/* Signature */}
            <div className="flex justify-between text-xs">
              <p>Fait à {s?.city ?? "—"}, le {fmtDate(preview.issueDate)}</p>
              {s?.signatoryName && <p>{s.signatoryName}, pour {s?.name}</p>}
            </div>

            {/* Coordonnées bancaires */}
            {(preview.iban || preview.bic || s?.bankName) && (
              <div className="text-xs space-y-0.5 border-t border-gray-100 pt-3">
                <p className="font-bold">Coordonnées bancaires</p>
                {s?.bankName && <p>Banque : {s.bankName}</p>}
                {preview.iban && <p>IBAN : {preview.iban}</p>}
                {preview.bic  && <p>BIC : {preview.bic}</p>}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
