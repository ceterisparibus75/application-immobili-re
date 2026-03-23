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
  personalAddress?: string | null;
  companyAddress?: string | null;
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
        <Button variant="outline" size="sm" onClick={undefined} className="print:hidden" asChild>
          <button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimer / Enregistrer en PDF
          </button>
        </Button>
      </div>

      {/* Document facture */}
      <div className="mx-auto max-w-3xl bg-white text-black rounded-lg border shadow-sm print:shadow-none print:border-none print:rounded-none p-10 space-y-8 text-sm">
        {/* En-tête : émetteur + logo */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {s?.logoUrl && (
              <img src={s.logoUrl} alt="Logo" className="h-14 object-contain mb-2" />
            )}
            <p className="font-bold text-base">{s?.name ?? "—"}</p>
            {s?.addressLine1 && <p>{s.addressLine1}</p>}
            {s?.addressLine2 && <p>{s.addressLine2}</p>}
            {(s?.postalCode || s?.city) && (
              <p>{[s.postalCode, s.city].filter(Boolean).join(" ")}</p>
            )}
            {s?.siret && <p className="text-gray-500 text-xs">SIRET : {s.siret}</p>}
            {s?.vatNumber && <p className="text-gray-500 text-xs">N° TVA : {s.vatNumber}</p>}
          </div>

          <div className="text-right space-y-1">
            <p className="text-2xl font-bold">
              {invoice.invoiceType === "AVOIR" ? "AVOIR" : "FACTURE"}
            </p>
            <p className="text-lg font-semibold text-gray-700">{invoice.invoiceNumber}</p>
            <p className="text-xs text-gray-500">
              Émission : {formatDate(invoice.issueDate)}
            </p>
            <p className="text-xs text-gray-500">
              Échéance : {formatDate(invoice.dueDate)}
            </p>
            {invoice.periodStart && invoice.periodEnd && (
              <p className="text-xs text-gray-500">
                Période : {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
              </p>
            )}
          </div>
        </div>

        {/* Destinataire */}
        <div className="rounded border border-gray-200 p-4 bg-gray-50 max-w-xs">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Destinataire</p>
          <p className="font-semibold">{tenantName(invoice.tenant)}</p>
          {tenantAddress(invoice.tenant) ? (
            <p className="text-xs text-gray-600 whitespace-pre-line mt-0.5">
              {tenantAddress(invoice.tenant)}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic mt-0.5">Adresse non renseignée</p>
          )}
          <p className="text-xs text-gray-600 mt-0.5">{tenantEmail(invoice.tenant)}</p>
          {invoice.tenant.phone && (
            <p className="text-xs text-gray-600">{invoice.tenant.phone}</p>
          )}
        </div>

        {/* Objet */}
        <div>
          <p className="font-medium">
            Objet : {TYPE_LABELS[invoice.invoiceType]}
            {invoice.lease && (
              <span className="text-gray-600 font-normal">
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
            <tr className="bg-gray-100 border border-gray-200">
              <th className="text-left px-3 py-2 font-semibold">Désignation</th>
              <th className="text-right px-3 py-2 font-semibold w-12">Qté</th>
              <th className="text-right px-3 py-2 font-semibold w-28">PU HT</th>
              <th className="text-right px-3 py-2 font-semibold w-20">TVA %</th>
              <th className="text-right px-3 py-2 font-semibold w-28">Total HT</th>
              <th className="text-right px-3 py-2 font-semibold w-28">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={line.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border-b border-gray-100">{line.label}</td>
                <td className="px-3 py-2 text-right border-b border-gray-100">{line.quantity}</td>
                <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums">
                  {formatCurrency(line.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right border-b border-gray-100 text-gray-500">
                  {line.vatRate} %
                </td>
                <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums">
                  {formatCurrency(line.totalHT)}
                </td>
                <td className="px-3 py-2 text-right border-b border-gray-100 tabular-nums font-medium">
                  {formatCurrency(line.totalTTC)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total HT</span>
              <span className="tabular-nums">{formatCurrency(invoice.totalHT)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">TVA</span>
              <span className="tabular-nums">{formatCurrency(invoice.totalVAT)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-2">
              <span>Total TTC</span>
              <span className="tabular-nums">{formatCurrency(invoice.totalTTC)}</span>
            </div>
          </div>
        </div>

        {/* Paiements déjà reçus */}
        {invoice.payments.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Règlements reçus</p>
            <div className="space-y-1">
              {invoice.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {formatDate(p.paidAt)}{p.method ? ` — ${p.method}` : ""}
                    {p.reference ? ` (${p.reference})` : ""}
                  </span>
                  <span className="tabular-nums font-medium text-green-700">
                    − {formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
            {(() => {
              const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
              const rest = invoice.totalTTC - paid;
              return rest > 0.01 ? (
                <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-gray-200">
                  <span>Solde restant dû</span>
                  <span className="tabular-nums text-red-600">{formatCurrency(rest)}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Mentions légales */}
        <div className="border-t border-gray-200 pt-4 space-y-1 text-xs text-gray-500">
          {s?.vatRegime === "FRANCHISE" ? (
            <p className="font-medium text-gray-700">TVA non applicable — article 293 B du CGI</p>
          ) : null}
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
  );
}
