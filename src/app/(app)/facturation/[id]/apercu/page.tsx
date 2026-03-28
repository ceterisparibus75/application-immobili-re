import { getInvoiceById } from "@/actions/invoice";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate, getLogoProxyUrl } from "@/lib/utils";
import { decrypt } from "@/lib/encryption";
import type { TenantEntityType, LegalForm } from "@/generated/prisma/client";
import { PrintButton } from "./_components/print-button";

const LEGAL_FORM_LABELS: Record<LegalForm, string> = {
  SCI:   "Société Civile Immobilière (SCI)",
  SARL:  "Société à Responsabilité Limitée (SARL)",
  SAS:   "Société par Actions Simplifiée (SAS)",
  SA:    "Société Anonyme (SA)",
  EURL:  "Entreprise Unipersonnelle à Responsabilité Limitée (EURL)",
  SASU:  "Société par Actions Simplifiée Unipersonnelle (SASU)",
  SNC:   "Société en Nom Collectif (SNC)",
  AUTRE: "Société",
};

function tenantName(t: {
  entityType: TenantEntityType;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || "—";
}

function tenantAddress(t: {
  entityType: TenantEntityType;
  personalAddress?: string | null;
  companyAddress?: string | null;
}) {
  return t.entityType === "PERSONNE_MORALE" ? t.companyAddress : t.personalAddress;
}

export default async function FactureApercuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const invoice = await getInvoiceById(societyId, id);
  if (!invoice) notFound();

  const s = invoice.society;
  const isAvoir = invoice.invoiceType === "AVOIR";

  // Déchiffrer les coordonnées bancaires
  let iban: string | null = null;
  let bic: string | null = null;
  try {
    if (s?.ibanEncrypted) iban = decrypt(s.ibanEncrypted);
    if (s?.bicEncrypted)  bic  = decrypt(s.bicEncrypted);
  } catch { /* non bloquant */ }

  // Solde précédent (factures non payées antérieures pour ce bail)
  let previousBalance = 0;
  if (invoice.lease?.id) {
    const unpaid = await prisma.invoice.findMany({
      where: {
        societyId,
        leaseId: invoice.lease.id,
        id: { not: invoice.id },
        status: { in: ["EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"] },
      },
      select: { totalTTC: true, payments: { select: { amount: true } } },
    });
    previousBalance = unpaid.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      return sum + (inv.totalTTC - paid);
    }, 0);
  }

  const totalToPay = previousBalance + invoice.totalTTC;
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);

  // Libellé du lot
  const lot = invoice.lease?.lot;
  const lotLabel = lot
    ? `${lot.number} — ${lot.building.addressLine1}, ${lot.building.postalCode} ${lot.building.city} ${lot.building.country ?? ""}`.trim()
    : null;

  // Titre selon type
  const typeTitle = isAvoir ? "AVOIR" :
    invoice.invoiceType === "APPEL_LOYER" ? "APPEL DE LOYER ET CHARGES" :
    invoice.invoiceType === "QUITTANCE"   ? "QUITTANCE DE LOYER" :
    invoice.invoiceType === "REGULARISATION_CHARGES" ? "RÉGULARISATION DE CHARGES" :
    "FACTURE";

  // Nom du fichier PDF suggéré : IMMEUBLE_LOCATAIRE_PERIODE
  function sanitize(str: string) {
    return str
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // supprimer accents
      .replace(/[^a-zA-Z0-9]/g, "_")                       // remplacer caractères spéciaux
      .replace(/_+/g, "_")                                  // dédoubler underscores
      .toUpperCase();
  }
  const buildingPart = lot?.building ? sanitize(lot.building.addressLine1 ?? lot.building.name ?? "") : "IMMEUBLE";
  const tenantNameRaw = invoice.tenant.entityType === "PERSONNE_MORALE"
    ? (invoice.tenant.companyName ?? "")
    : `${invoice.tenant.firstName ?? ""} ${invoice.tenant.lastName ?? ""}`.trim();
  const tenantPart = sanitize(tenantNameRaw) || "LOCATAIRE";
  const periodPart = invoice.periodStart
    ? sanitize(new Date(invoice.periodStart).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }))
    : sanitize(new Date(invoice.issueDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  const pdfFilename = `${buildingPart}_${tenantPart}_${periodPart}`;

  return (
    <div className="space-y-4">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/facturation/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </Link>
        <PrintButton filename={pdfFilename} />
      </div>

      {/* ═══════════════════════════════════════
          DOCUMENT FACTURE
      ═══════════════════════════════════════ */}
      <div className="mx-auto max-w-3xl bg-white text-gray-900 print:shadow-none print:max-w-none text-sm font-sans">

        {/* ── 1. Numéro + date (centré en haut) ── */}
        <div className="text-center mb-6 text-sm">
          <p>Facture n° : <span className="font-semibold">{invoice.invoiceNumber}</span></p>
          <p>Émise le : {formatDate(invoice.issueDate)}</p>
        </div>

        {/* ── 2. Émetteur (gauche) + Destinataire (droite) ── */}
        <div className="flex items-start gap-8 mb-8">

          {/* Émetteur */}
          <div className="flex-1 space-y-1 text-sm">
            {s?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getLogoProxyUrl(s.logoUrl) ?? ""} alt="Logo" className="h-20 object-contain mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <p className="font-bold text-base">{s?.name ?? "—"}</p>
            {s?.addressLine1 && <p>{s.addressLine1}, {[s.postalCode, s.city, s.country].filter(Boolean).join(" ")}</p>}
            {s?.addressLine2 && <p>{s.addressLine2}</p>}
            {s?.phone && <p>Tél. : {s.phone}</p>}
            {s?.legalForm && s?.shareCapital && (
              <p>{LEGAL_FORM_LABELS[s.legalForm]} au capital de {formatCurrency(s.shareCapital)}</p>
            )}
            {s?.legalForm && !s?.shareCapital && (
              <p>{LEGAL_FORM_LABELS[s.legalForm]}</p>
            )}
            {s?.siret && <p>SIRET : {s.siret}</p>}
            {s?.vatNumber && <p>N° TVA : {s.vatNumber}</p>}
          </div>

          {/* Destinataire — boîte avec coins "+" */}
          <div className="w-72 relative p-6 text-sm">
            <span className="absolute top-1 left-1 text-gray-400 font-light select-none">+</span>
            <span className="absolute top-1 right-1 text-gray-400 font-light select-none">+</span>
            <span className="absolute bottom-1 left-1 text-gray-400 font-light select-none">+</span>
            <span className="absolute bottom-1 right-1 text-gray-400 font-light select-none">+</span>
            <div className="space-y-1">
              <p className="font-semibold">{tenantName(invoice.tenant)}</p>
              {tenantAddress(invoice.tenant) ? (
                <p className="whitespace-pre-line">{tenantAddress(invoice.tenant)}</p>
              ) : (
                <>
                  <p className="text-gray-400 italic text-xs">Adresse non renseignée</p>
                  <p>{invoice.tenant.email}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. Titre ── */}
        <h1 className="text-2xl font-bold mb-4">{typeTitle}</h1>

        {/* ── 4. Infos période / lot ── */}
        <div className="space-y-1 mb-6 text-sm">
          <p>Date d&apos;échéance : {formatDate(invoice.dueDate)}</p>
          {invoice.periodStart && invoice.periodEnd && (
            <p>Pour la période du {formatDate(invoice.periodStart)} au {formatDate(invoice.periodEnd)}.</p>
          )}
          {invoice.creditNoteFor && (
            <p className="text-gray-500">Avoir correspondant à la facture {invoice.creditNoteFor.invoiceNumber}</p>
          )}
          {lotLabel && (
            <>
              <p>Lot(s) concerné(s) :</p>
              <p>{lotLabel}</p>
            </>
          )}
        </div>

        {/* ── 5. Tableau des lignes ── */}
        <table className="w-full text-sm border-collapse mb-2">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-3 py-2 font-semibold border border-gray-200">Libellé opération</th>
              <th className="text-right px-3 py-2 font-semibold border border-gray-200 w-32">Montant HT</th>
              <th className="text-right px-3 py-2 font-semibold border border-gray-200 w-24">TVA</th>
              <th className="text-right px-3 py-2 font-semibold border border-gray-200 w-32">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={line.id} className={i % 2 === 0 ? "" : "bg-gray-50/40"}>
                <td className="px-3 py-2 border-b border-gray-100">
                  <p>{line.label}</p>
                  {lot && <p className="text-gray-500 text-xs">{lot.number}</p>}
                </td>
                <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums">
                  {formatCurrency(line.totalHT)}
                </td>
                <td className="px-3 py-2 text-right border-b border-gray-100 text-gray-500">
                  {line.vatRate.toFixed(2).replace(".", ",")} %
                </td>
                <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums">
                  {formatCurrency(line.totalTTC)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} />
              <td className="px-3 py-2 text-right text-gray-600 text-sm border-t border-gray-200">Total HT</td>
              <td className="px-3 py-2 text-right tabular-nums border-t border-gray-200">{formatCurrency(invoice.totalHT)}</td>
            </tr>
            {invoice.totalVAT > 0.001 && (
              <tr>
                <td colSpan={2} />
                <td className="px-3 py-2 text-right text-gray-600 text-sm">TVA</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(invoice.totalVAT)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2} />
              <td className="px-3 py-2 text-right font-bold border-t border-gray-400">TOTAL TTC</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums border-t border-gray-400">
                {formatCurrency(invoice.totalTTC)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── 6. Paiements reçus ── */}
        {paid > 0.001 && (
          <div className="mb-6 text-sm">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-green-700">
                <span>Règlement reçu le {formatDate(p.paidAt)}{p.method ? ` (${p.method})` : ""}</span>
                <span className="tabular-nums">− {formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── 7. Situation de compte ── */}
        <div className="mt-8 mb-6">
          <p className="font-bold text-sm mb-1">Situation de compte au {formatDate(invoice.issueDate)}</p>
          <p className="text-sm text-gray-600 mb-3">
            Retrouvez ci-dessous la somme totale dont vous êtes redevable. Il s&apos;agit du montant
            de votre solde précédent auquel s&apos;ajoute le montant de cette facture.
          </p>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="border border-gray-200 px-4 py-2">Solde précédent à date d&apos;édition</td>
                <td className="border border-gray-200 px-4 py-2 text-right tabular-nums">
                  {previousBalance !== 0
                    ? `${previousBalance > 0 ? "" : "−"} ${formatCurrency(Math.abs(previousBalance))}`
                    : formatCurrency(0)}
                </td>
              </tr>
              <tr className="font-bold">
                <td className="border border-gray-200 px-4 py-2">
                  Total à payer avant le {formatDate(invoice.dueDate)}
                </td>
                <td className="border border-gray-200 px-4 py-2 text-right tabular-nums">
                  {formatCurrency(Math.max(0, totalToPay - paid))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 8. Mentions légales ── */}
        <div className="text-xs text-gray-600 mb-6 leading-relaxed">
          {s?.vatRegime === "FRANCHISE" && (
            <p className="font-semibold mb-1">TVA non applicable — art. 293 B du CGI</p>
          )}
          <p>
            Pas d&apos;escompte pour règlement anticipé. En cas de retard de paiement, une pénalité
            égale à 3 fois le taux intérêt légal sera exigible (Article L 441-10, alinéa 12 du Code de
            Commerce). Pour tout professionnel, en sus des indemnités de retard, toute somme, y compris
            l&apos;acompte, non payée à sa date d&apos;exigibilité produira de plein droit le paiement
            d&apos;une indemnité forfaitaire de 40 euros due au titre des frais de recouvrement
            (Art. 441-6, I al. 12 du code de commerce et D. 441-5 ibidem).
          </p>
          {s?.legalMentions && (
            <p className="mt-1 whitespace-pre-wrap">{s.legalMentions}</p>
          )}
        </div>

        {/* ── 9. Signature ── */}
        <div className="flex justify-between text-sm mb-6">
          <p>Fait à {s?.city ?? "—"}, le {formatDate(invoice.issueDate)}</p>
          {s?.signatoryName && (
            <p>{s.signatoryName}, pour {s.name}</p>
          )}
        </div>

        {/* ── 10. Coordonnées bancaires ── */}
        {(iban || bic || s?.bankName) && (
          <div className="text-sm space-y-0.5">
            <p className="font-bold">Coordonnées bancaires</p>
            {s?.bankName && <p>Banque : {s.bankName}</p>}
            {iban && <p>IBAN : {iban}</p>}
            {bic  && <p>BIC : {bic}</p>}
          </div>
        )}

      </div>
    </div>
  );
}
