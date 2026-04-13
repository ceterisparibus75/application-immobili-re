"use client";

import { Sheet, SheetContent, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, Printer, X, Zap } from "lucide-react";
import type { InvoicePreview } from "@/actions/invoice";

function sanitizeSpaces(str: string) { return str.replace(/\u00A0|\u202F|\u2009|\u200A|\u2007/g, " "); }
function fmt(v: number) {
  return sanitizeSpaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v));
}
function fmtNum(v: number) {
  return sanitizeSpaces(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v));
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR");
}

const LEGAL_FORM_LABELS: Record<string, string> = {
  SCI: "Societe Civile Immobiliere (SCI)", SARL: "SARL",
  SAS: "SAS", SA: "SA", EURL: "EURL", SASU: "SASU", SNC: "SNC", AUTRE: "Societe",
  PERSONNE_PHYSIQUE: "Proprietaire",
};

function typeTitle(invoiceType: string): string {
  if (invoiceType === "APPEL_LOYER") return "APPEL DE LOYER ET CHARGES";
  if (invoiceType === "QUITTANCE") return "QUITTANCE DE LOYER";
  if (invoiceType === "REGULARISATION_CHARGES") return "RÉGULARISATION DE CHARGES";
  if (invoiceType === "REFACTURATION") return "REFACTURATION";
  return "FACTURE";
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

        {/* Document — scrollable, reproduit la mise en page du PDF */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="bg-white text-gray-900 font-sans" style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 10, padding: "50px 50px 70px" }}>

            {/* Logo centré (comme le PDF) */}
            {preview.logoResolvedUrl ? (
              <div className="flex justify-center mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.logoResolvedUrl} alt="Logo" style={{ maxHeight: 96, maxWidth: 240, objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            ) : null}

            {/* Émetteur (gauche) + Destinataire (droite) */}
            <div className="flex items-start mb-6">
              <div className="flex-1 pr-4">
                <p style={{ fontSize: 12, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, marginBottom: 2 }}>{s?.name ?? "---"}</p>
                {s?.addressLine1 && (
                  <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 1 }}>
                    {s.addressLine1}, {[s.postalCode, s.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {s?.phone && <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 1 }}>Tél. : {s.phone}</p>}
                {s?.legalForm && s?.shareCapital ? (
                  <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 1 }}>
                    {LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm} au capital de {fmtNum(s.shareCapital)}{"\u20AC"}
                  </p>
                ) : s?.legalForm ? (
                  <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 1 }}>{LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm}</p>
                ) : null}
                {s?.siret && <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 1 }}>SIRET : {s.siret}</p>}
                {s?.vatNumber && <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 1 }}>N° TVA : {s.vatNumber}</p>}
              </div>

              {/* Destinataire avec coins + */}
              <div className="relative p-3" style={{ width: 180 }}>
                <span className="absolute text-gray-300 select-none" style={{ top: 2, left: 2, fontSize: 10 }}>+</span>
                <span className="absolute text-gray-300 select-none" style={{ top: 2, right: 2, fontSize: 10 }}>+</span>
                <span className="absolute text-gray-300 select-none" style={{ bottom: 2, left: 2, fontSize: 10 }}>+</span>
                <span className="absolute text-gray-300 select-none" style={{ bottom: 2, right: 2, fontSize: 10 }}>+</span>
                <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{preview.tenantName}</p>
                {preview.tenantAddress ? (
                  <p className="whitespace-pre-line" style={{ fontSize: 8.5, color: "#6b7280" }}>{preview.tenantAddress}</p>
                ) : (
                  <p style={{ fontSize: 8, color: "#9ca3af" }}>{preview.tenantEmail ?? "Adresse non renseignée"}</p>
                )}
              </div>
            </div>

            {/* Titre */}
            <p style={{ fontSize: 15, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, marginBottom: 4 }}>{typeTitle(preview.invoiceType)}</p>

            {/* Infos facture */}
            <div style={{ marginBottom: 2 }}>
              <p style={{ fontSize: 8.5, marginBottom: 2 }}>Facture n° : — prévisualisation —&nbsp;&nbsp;&nbsp;Émise le : {fmtDate(preview.issueDate)}</p>
              <p style={{ fontSize: 8.5, marginBottom: 2 }}>Date d&apos;échéance : {fmtDate(preview.dueDate)}</p>
              <p style={{ fontSize: 8.5, marginBottom: 2 }}>Période du {fmtDate(preview.periodStartISO)} au {fmtDate(preview.periodEndISO)}.</p>
              {preview.lotLabel && <p style={{ fontSize: 8.5, marginTop: 2 }}>Lot(s) : {preview.lotLabel}</p>}
            </div>

            {/* Tableau des lignes */}
            <table className="w-full border-collapse" style={{ fontSize: 8.5, marginTop: 10, marginBottom: 4 }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th className="text-left" style={{ padding: 5, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", fontSize: 8, fontWeight: 700 }}>Libellé</th>
                  <th className="text-right" style={{ padding: 5, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", fontSize: 8, fontWeight: 700, width: 70 }}>HT</th>
                  <th className="text-right" style={{ padding: 5, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", fontSize: 8, fontWeight: 700, width: 50 }}>TVA</th>
                  <th className="text-right" style={{ padding: 5, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", fontSize: 8, fontWeight: 700, width: 70 }}>TTC</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 1 ? "#fafafa" : undefined }}>
                    <td style={{ padding: 5, borderBottom: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 8.5 }}>{line.label}</span>
                      {preview.lotNumber && <br />}
                      {preview.lotNumber && <span style={{ fontSize: 7, color: "#6b7280" }}>{preview.lotNumber}</span>}
                    </td>
                    <td className="text-right tabular-nums" style={{ padding: 5, borderBottom: "1px solid #e5e7eb", fontSize: 8.5 }}>{fmt(line.totalHT)}</td>
                    <td className="text-right" style={{ padding: 5, borderBottom: "1px solid #e5e7eb", fontSize: 8.5, color: "#6b7280" }}>{line.vatRate.toFixed(2).replace(".", ",")} %</td>
                    <td className="text-right tabular-nums" style={{ padding: 5, borderBottom: "1px solid #e5e7eb", fontSize: 8.5 }}>{fmt(line.totalTTC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totaux — alignés à droite comme le PDF */}
            <div style={{ marginTop: 4, marginBottom: 10 }}>
              <div className="flex justify-end">
                <span className="text-right" style={{ width: 100, fontSize: 8.5, color: "#6b7280", paddingRight: 8 }}>Total HT</span>
                <span className="text-right tabular-nums" style={{ width: 80, fontSize: 8.5 }}>{fmt(preview.totalHT)}</span>
              </div>
              {preview.totalVAT > 0.001 && (
                <div className="flex justify-end">
                  <span className="text-right" style={{ width: 100, fontSize: 8.5, color: "#6b7280", paddingRight: 8 }}>TVA</span>
                  <span className="text-right tabular-nums" style={{ width: 80, fontSize: 8.5 }}>{fmt(preview.totalVAT)}</span>
                </div>
              )}
              <div className="flex justify-end" style={{ borderTop: "1px solid #111827", paddingTop: 3, marginTop: 1 }}>
                <span className="text-right" style={{ width: 100, fontSize: 9, fontWeight: 700, paddingRight: 8 }}>TOTAL TTC</span>
                <span className="text-right tabular-nums" style={{ width: 80, fontSize: 9, fontWeight: 700 }}>{fmt(preview.totalTTC)}</span>
              </div>
            </div>

            {/* Situation de compte */}
            <p style={{ fontSize: 9, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>Situation de compte au {fmtDate(preview.issueDate)}</p>
            <p style={{ fontSize: 8, color: "#6b7280", marginBottom: 6 }}>
              Retrouvez ci-dessous la somme totale dont vous êtes redevable. Il s&apos;agit du montant de votre solde précédent auquel s&apos;ajoute le montant de cette facture.
            </p>
            <table className="w-full border-collapse" style={{ fontSize: 8.5, marginBottom: 12 }}>
              <tbody>
                <tr>
                  <td style={{ flex: 1, padding: 6, border: "1px solid #e5e7eb" }}>Solde précédent</td>
                  <td className="text-right tabular-nums" style={{ width: 100, padding: 6, border: "1px solid #e5e7eb" }}>{fmt(preview.previousBalance)}</td>
                </tr>
                <tr>
                  <td style={{ flex: 1, padding: 6, border: "1px solid #e5e7eb", fontWeight: 700 }}>
                    Total à payer au {fmtDate(preview.dueDate)}
                  </td>
                  <td className="text-right tabular-nums" style={{ width: 100, padding: 6, border: "1px solid #e5e7eb", fontWeight: 700 }}>
                    {fmt(Math.max(0, preview.previousBalance + preview.totalTTC))}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Mentions légales */}
            <div style={{ fontSize: 7, color: "#6b7280", marginTop: 12, lineHeight: 1.4 }}>
              {s?.vatRegime === "FRANCHISE" && (
                <p style={{ fontWeight: 700, marginBottom: 2 }}>TVA non applicable - art. 293 B du CGI</p>
              )}
              <p>
                Pas d&apos;escompte pour règlement anticipé. En cas de retard de paiement, une pénalité égale à 3 fois le taux intérêt légal sera exigible (Article L 441-10, alinéa 12 du Code de Commerce). Pour tout professionnel, en sus des indemnités de retard, toute somme, y compris l&apos;acompte, non payée à sa date d&apos;exigibilité produira de plein droit le paiement d&apos;une indemnité forfaitaire de 40 euros due au titre des frais de recouvrement (Art. 441-6, I al. 12 du code de commerce et D. 441-5 ibidem).
              </p>
              {s?.legalMentions && <p style={{ marginTop: 3 }}>{s.legalMentions}</p>}
            </div>

            {/* Signature */}
            <div className="text-right" style={{ marginTop: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 8.5 }}>Fait à {s?.city ?? "---"}, le {fmtDate(preview.issueDate)}</p>
              {s?.signatoryName && <p style={{ fontSize: 8.5 }}>{s.signatoryName}, pour {s?.name}</p>}
            </div>

            {/* Coordonnées bancaires */}
            {(preview.iban || preview.bic || s?.bankName) && (
              <div style={{ marginTop: 8, fontSize: 8.5 }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>Coordonnées bancaires</p>
                {s?.bankName && <p>Banque : {s.bankName}</p>}
                {preview.iban && <p>IBAN : {preview.iban}</p>}
                {preview.bic  && <p>BIC : {preview.bic}</p>}
              </div>
            )}

            {/* Pied de page (simule le footer du PDF) */}
            <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 16, paddingTop: 5 }}>
              <p className="text-center" style={{ fontSize: 7, color: "#6b7280" }}>
                {[
                  s?.addressLine1 ? s.addressLine1 + ([s.postalCode, s.city].filter(Boolean).length > 0 ? ", " + [s.postalCode, s.city].filter(Boolean).join(" ") : "") : null,
                  s?.legalForm && s?.shareCapital ? (LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm) + " au capital de " + fmtNum(s.shareCapital) + "\u20AC" : s?.legalForm ? (LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm) : null,
                  s?.siret ? "SIRET : " + s.siret : null,
                  s?.email ?? null,
                ].filter((p): p is string => p !== null && p !== undefined && p !== "").join("  |  ")}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
