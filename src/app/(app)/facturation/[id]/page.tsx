export const maxDuration = 30;

import { getInvoiceById } from "@/actions/invoice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, CreditCard, User, ReceiptText, Eye, Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { InvoiceStatus, InvoiceType, TenantEntityType } from "@/generated/prisma/client";
import { getLogoProxyUrl } from "@/lib/utils";
import { LogoImage } from "./_components/logo-image";
import PaymentForm from "./_components/payment-form";
import { SendInvoiceButton } from "./_components/send-invoice-button";
import { SepaButton } from "./_components/sepa-button";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: "Brouillon", VALIDEE: "Validée", ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente", PAYE: "Payée", PARTIELLEMENT_PAYE: "Partiellement payée",
  EN_RETARD: "En retard", RELANCEE: "Relancée", LITIGIEUX: "Litigieux",
  IRRECOUVRABLE: "Irrécouvrable", ANNULEE: "Annulée",
};

const STATUS_VARIANTS: Record<InvoiceStatus, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  BROUILLON: "outline", VALIDEE: "secondary", ENVOYEE: "default",
  EN_ATTENTE: "default", PAYE: "success", PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive", RELANCEE: "destructive", LITIGIEUX: "destructive",
  IRRECOUVRABLE: "secondary", ANNULEE: "outline",
};

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

export default async function FactureDetailPage({
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

  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = invoice.totalTTC - totalPaid;
  const isPaid = invoice.status === "PAYE";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/facturation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              {invoice.society?.logoUrl && getLogoProxyUrl(invoice.society.logoUrl) && (
                <LogoImage src={getLogoProxyUrl(invoice.society.logoUrl)!} className="h-10 object-contain" />
              )}
              <h1 className="text-2xl font-bold tracking-tight">
                {invoice.invoiceNumber}
              </h1>
              <Badge variant={STATUS_VARIANTS[invoice.status]}>
                {STATUS_LABELS[invoice.status]}
              </Badge>
              {invoice.invoiceType === "AVOIR" && (
                <Badge variant="secondary">Avoir</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {TYPE_LABELS[invoice.invoiceType]} —{" "}
              {tenantName(invoice.tenant)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/facturation/${invoice.id}/apercu`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
              Aperçu
            </Button>
          </Link>
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </a>
          {invoice.status !== "BROUILLON" && (
            <SendInvoiceButton invoiceId={invoice.id} societyId={societyId} />
          )}
          {invoice.invoiceType !== "AVOIR" && invoice.creditNotes.length === 0 && (
            <Link href={`/facturation/${invoice.id}/avoir`}>
              <Button variant="outline" size="sm">
                <ReceiptText className="h-4 w-4" />
                Émettre un avoir
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dates */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Date d&apos;émission</p>
                  <p className="text-sm font-medium">
                    {new Date(invoice.issueDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date d&apos;échéance</p>
                  <p className="text-sm font-medium">
                    {new Date(invoice.dueDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                {invoice.periodStart && invoice.periodEnd && (
                  <div>
                    <p className="text-xs text-muted-foreground">Période</p>
                    <p className="text-sm font-medium">
                      {new Date(invoice.periodStart).toLocaleDateString("fr-FR")}{" "}
                      →{" "}
                      {new Date(invoice.periodEnd).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lignes */}
          <Card>
            <CardHeader>
              <CardTitle>Détail de la facture</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2">Désignation</th>
                    <th className="text-right pb-2">Qté</th>
                    <th className="text-right pb-2">PU HT</th>
                    <th className="text-right pb-2">TVA %</th>
                    <th className="text-right pb-2">Total HT</th>
                    <th className="text-right pb-2">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="py-2">{line.label}</td>
                      <td className="py-2 text-right">{line.quantity}</td>
                      <td className="py-2 text-right">
                        {line.unitPrice.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </td>
                      <td className="py-2 text-right">{line.vatRate} %</td>
                      <td className="py-2 text-right">
                        {line.totalHT.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </td>
                      <td className="py-2 text-right font-medium">
                        {line.totalTTC.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Separator className="my-4" />

              <div className="space-y-1 text-sm max-w-xs ml-auto">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total HT</span>
                  <span>
                    {invoice.totalHT.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TVA</span>
                  <span>
                    {invoice.totalVAT.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold border-t pt-1 mt-1">
                  <span>Total TTC</span>
                  <span>
                    {invoice.totalTTC.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Liens avoir */}
          {invoice.creditNoteFor && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Avoir de la facture</span>
              <Link href={`/facturation/${invoice.creditNoteFor.id}`} className="font-medium hover:underline">
                {invoice.creditNoteFor.invoiceNumber}
              </Link>
            </div>
          )}
          {invoice.creditNotes.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Avoir émis</span>
              <Link href={`/facturation/${invoice.creditNotes[0]!.id}`} className="font-medium hover:underline">
                {invoice.creditNotes[0]!.invoiceNumber}
              </Link>
            </div>
          )}

          {/* Paiements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Paiements reçus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.payments.length > 0 ? (
                <div className="divide-y">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(payment.paidAt).toLocaleDateString("fr-FR")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.method ?? "—"}
                          {payment.reference && ` — Réf: ${payment.reference}`}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-[var(--color-status-positive)]">
                        + {payment.amount.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun paiement enregistré</p>
              )}

              {!isPaid && (
                <>
                  <Separator />
                  <div className="flex justify-between text-sm font-medium">
                    <span>Reste à payer</span>
                    <span className="text-destructive">
                      {remaining.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <PaymentForm invoiceId={invoice.id} societyId={societyId} />
                  {invoice.tenant.sepaMandates?.[0] && (
                    <div className="pt-2">
                      <SepaButton
                        invoiceId={invoice.id}
                        societyId={societyId}
                        mandateId={invoice.tenant.sepaMandates[0].id}
                        mandateRef={invoice.tenant.sepaMandates[0].mandateReference}
                        ibanLast4={invoice.tenant.sepaMandates[0].ibanLast4}
                        remaining={remaining}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          {/* Mentions légales */}
          {invoice.society && (
            <Card>
              <CardContent className="pt-4 space-y-1 text-xs text-muted-foreground">
                {invoice.society.name && (
                  <p className="font-medium text-foreground">{invoice.society.name}</p>
                )}
                {invoice.society.addressLine1 && (
                  <p>{invoice.society.addressLine1}{invoice.society.addressLine2 ? `, ${invoice.society.addressLine2}` : ""}</p>
                )}
                {invoice.society.postalCode && invoice.society.city && (
                  <p>{invoice.society.postalCode} {invoice.society.city}</p>
                )}
                {invoice.society.siret && <p>SIRET : {invoice.society.siret}</p>}
                {invoice.society.vatNumber && <p>N° TVA : {invoice.society.vatNumber}</p>}
                {invoice.society.vatRegime === "FRANCHISE" && (
                  <p className="font-medium text-foreground">TVA non applicable — art. 293 B du CGI</p>
                )}
                <p>En cas de retard de paiement, des pénalités de retard sont exigibles au taux de 3 fois le taux d&apos;intérêt légal, ainsi qu&apos;une indemnité forfaitaire de recouvrement de 40 € (art. D. 441-5 C. com.).</p>
                {invoice.society.legalMentions && (
                  <p className="whitespace-pre-wrap">{invoice.society.legalMentions}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Locataire */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Locataire
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{tenantName(invoice.tenant)}</p>
              <p className="text-xs text-muted-foreground">{invoice.tenant.email}</p>
              {invoice.tenant.phone && (
                <p className="text-xs text-muted-foreground">{invoice.tenant.phone}</p>
              )}
              {invoice.tenant.mobile && (
                <p className="text-xs text-muted-foreground">{invoice.tenant.mobile}</p>
              )}
              <Link href={`/locataires/${invoice.tenant.id}`}>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  Voir le locataire
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Bail associé */}
          {invoice.lease && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Bail associé
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium">
                  {invoice.lease.lot.building.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lot {invoice.lease.lot.number} —{" "}
                  {invoice.lease.lot.building.city}
                </p>
                <Link href={`/baux/${invoice.lease.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Voir le bail
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
