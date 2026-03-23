import { getInvoiceById } from "@/actions/invoice";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceType, TenantEntityType } from "@prisma/client";

const TYPE_LABELS: Record<InvoiceType, string> = {
  APPEL_LOYER: "Appel de loyer",
  QUITTANCE: "Quittance de loyer",
  REGULARISATION_CHARGES: "Régularisation de charges",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
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

function tenantEmail(t: { email: string; billingEmail?: string | null }) {
  return t.billingEmail || t.email;
}

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente de règlement",
  PAYE: "Payée",
  PARTIELLEMENT_PAYE: "Partiellement réglée",
  EN_RETARD: "En retard",
  LITIGIEUX: "Litigieux",
};

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

  // Grouper les taux de TVA pour le récapitulatif
  const vatBreakdown = invoice.lines.reduce<Record<number, { ht: number; vat: number }>>((acc, l) => {
    if (!acc[l.vatRate]) acc[l.vatRate] = { ht: 0, vat: 0 };
    acc[l.vatRate].ht += l.totalHT;
    acc[l.vatRate].vat += l.totalVAT;
    return acc;
  }, {});

  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = invoice.totalTTC - paid;

  return (
    <div className="space-y-4">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/facturation/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </Link>
        <Button variant="outline" size="sm" asChild>
          <button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimer / PDF
          </button>
        </Button>
      </div>

      {/* ─── Document facture ─── */}
      <div className="mx-auto max-w-3xl bg-white text-gray-900 rounded-lg border shadow print:shadow-none print:border-none print:rounded-none print:max-w-none text-sm">

        {/* Bandeau supérieur coloré */}
        <div className="bg-gray-900 text-white px-10 py-5 rounded-t-lg print:rounded-none flex items-center justify-between">
          <div>
            {s?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="Logo" className="h-12 object-contain brightness-0 invert" />
            ) : (
              <p className="text-xl font-bold tracking-wide">{s?.name ?? "—"}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-widest">{isAvoir ? "AVOIR" : "FACTURE"}</p>
            <p className="text-gray-300 text-sm mt-0.5">{invoice.invoiceNumber}</p>
          </div>
        </div>

        <div className="px-10 py-8 space-y-8">
          {/* Bloc émetteur / destinataire */}
          <div className="grid grid-cols-2 gap-8">
            {/* Émetteur (société) */}
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">De</p>
              <p className="font-bold text-base">{s?.name ?? "—"}</p>
              {s?.addressLine1 && <p className="text-gray-600">{s.addressLine1}</p>}
              {s?.addressLine2 && <p className="text-gray-600">{s.addressLine2}</p>}
              {(s?.postalCode || s?.city) && (
                <p className="text-gray-600">{[s.postalCode, s.city].filter(Boolean).join(" ")}</p>
              )}
              {s?.siret && <p className="text-gray-500 text-xs mt-1">SIRET : {s.siret}</p>}
              {s?.vatNumber && <p className="text-gray-500 text-xs">N° TVA intracommunautaire : {s.vatNumber}</p>}
            </div>

            {/* Destinataire (locataire) */}
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">À</p>
              <p className="font-bold text-base">{tenantName(invoice.tenant)}</p>
              {tenantAddress(invoice.tenant) ? (
                <p className="text-gray-600 whitespace-pre-line">{tenantAddress(invoice.tenant)}</p>
              ) : (
                <p className="text-gray-400 italic text-xs">Adresse non renseignée</p>
              )}
              <p className="text-gray-600">{tenantEmail(invoice.tenant)}</p>
              {invoice.tenant.phone && (
                <p className="text-gray-600">{invoice.tenant.phone}</p>
              )}
            </div>
          </div>

          {/* Méta-données de la facture */}
          <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg px-6 py-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Date d&apos;émission</p>
              <p className="font-semibold mt-0.5">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Date d&apos;échéance</p>
              <p className="font-semibold mt-0.5">{formatDate(invoice.dueDate)}</p>
            </div>
            {invoice.periodStart && invoice.periodEnd && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Période</p>
                <p className="font-semibold mt-0.5">
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                </p>
              </div>
            )}
          </div>

          {/* Objet */}
          <div>
            <p className="font-semibold text-gray-700">
              Objet : {TYPE_LABELS[invoice.invoiceType]}
              {invoice.lease && (
                <span className="font-normal text-gray-500">
                  {" "}— {invoice.lease.lot.building.name}, Lot {invoice.lease.lot.number}
                </span>
              )}
            </p>
            {invoice.creditNoteFor && (
              <p className="text-xs text-gray-500 mt-1">
                Avoir correspondant à la facture {invoice.creditNoteFor.invoiceNumber}
              </p>
            )}
          </div>

          {/* Tableau des lignes */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900 text-left">
                <th className="pb-2 font-semibold text-gray-700">Désignation</th>
                <th className="pb-2 font-semibold text-gray-700 text-right w-10">Qté</th>
                <th className="pb-2 font-semibold text-gray-700 text-right w-28">P.U. HT</th>
                <th className="pb-2 font-semibold text-gray-700 text-right w-16">TVA</th>
                <th className="pb-2 font-semibold text-gray-700 text-right w-28">Montant HT</th>
                <th className="pb-2 font-semibold text-gray-700 text-right w-28">Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={line.id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                  <td className="py-2.5 pr-4">{line.label}</td>
                  <td className="py-2.5 text-right text-gray-600">{line.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                  <td className="py-2.5 text-right text-gray-500">{line.vatRate} %</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrency(line.totalHT)}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium">{formatCurrency(line.totalTTC)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1.5">
              {/* Récap TVA par taux */}
              {Object.entries(vatBreakdown).map(([rate, vals]) => (
                <div key={rate} className="flex justify-between text-sm text-gray-600">
                  <span>TVA {rate} %</span>
                  <span className="tabular-nums">{formatCurrency(vals.vat)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1">
                <span className="text-gray-600">Total HT</span>
                <span className="tabular-nums font-medium">{formatCurrency(invoice.totalHT)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total TVA</span>
                <span className="tabular-nums font-medium">{formatCurrency(invoice.totalVAT)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t-2 border-gray-900 pt-2 mt-1">
                <span>Total TTC</span>
                <span className="tabular-nums">{formatCurrency(invoice.totalTTC)}</span>
              </div>

              {/* Paiements et solde */}
              {invoice.payments.length > 0 && (
                <>
                  {invoice.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm text-green-700">
                      <span>
                        Règlement {formatDate(p.paidAt)}
                        {p.method ? ` (${p.method})` : ""}
                      </span>
                      <span className="tabular-nums">− {formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                  {remaining > 0.01 && (
                    <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1 text-red-600">
                      <span>Solde restant dû</span>
                      <span className="tabular-nums">{formatCurrency(remaining)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Statut */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              invoice.status === "PAYE" ? "bg-green-100 text-green-800" :
              invoice.status === "EN_RETARD" ? "bg-red-100 text-red-800" :
              invoice.status === "PARTIELLEMENT_PAYE" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
          </div>

          {/* Coordonnées bancaires si disponibles */}
          {(s as { iban?: string | null } | null)?.iban && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm">
              <p className="font-semibold text-gray-700 mb-1">Coordonnées bancaires</p>
              <p className="text-gray-600">IBAN : {(s as { iban: string }).iban}</p>
            </div>
          )}

          {/* Mentions légales */}
          <div className="border-t border-gray-200 pt-6 space-y-2 text-xs text-gray-500">
            {s?.vatRegime === "FRANCHISE" && (
              <p className="font-semibold text-gray-700">TVA non applicable — art. 293 B du CGI</p>
            )}
            <p>
              En cas de retard de paiement, des pénalités sont exigibles au taux de 3 fois le taux d&apos;intérêt
              légal, ainsi qu&apos;une indemnité forfaitaire de recouvrement de 40 € (art. D. 441-5 C. com.).
            </p>
            {s?.legalMentions && (
              <p className="whitespace-pre-wrap">{s.legalMentions}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
