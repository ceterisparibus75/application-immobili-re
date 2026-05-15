export const maxDuration = 30;

import { getInvoiceById } from "@/actions/invoice";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, CreditCard, User, ReceiptText, Eye, Download, FileCode2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { InvoiceStatus, InvoiceType, TenantEntityType } from "@/generated/prisma/client";
import { getLogoProxyUrl } from "@/lib/utils";
import { LogoImage } from "./_components/logo-image";
import PaymentForm from "./_components/payment-form";
import { SendInvoiceButton } from "./_components/send-invoice-button";
import { RefreshDraftButton } from "./_components/refresh-draft-button";
import { SepaButton } from "./_components/sepa-button";
import { SubmitEInvoiceButton } from "./_components/submit-einvoice-button";
import { PaStatusCard } from "./_components/pa-status-card";
import { LinkBuildingButton } from "./_components/link-building-button";
import { SettleAvoirButton } from "./_components/settle-avoir-button";
import { NoteEditor } from "./_components/note-editor";
import { ValidateInvoiceButton } from "./_components/validate-invoice-button";
import { DatesEditor } from "./_components/dates-editor";
import { LinesEditor } from "./_components/lines-editor";
import { DuplicateInvoiceButton } from "./_components/duplicate-invoice-button";
import { DeleteDraftButton } from "./_components/delete-draft-button";
import { EmailDeliveryProofsCard } from "./_components/email-delivery-proofs-card";
import { isEInvoicingConfigured } from "@/lib/pa-client";
import { resolveActiveOwnership } from "@/lib/lot-ownership-resolver";
import { Crown } from "lucide-react";

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
  DEPOT_DE_GARANTIE: "Dépôt de garantie",
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

  const deliveryProofs = await prisma.emailDeliveryProof.findMany({
    where: { societyId, invoiceId: invoice.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      status: true,
      recipientEmail: true,
      subject: true,
      providerMessageId: true,
      deliveredAt: true,
      bouncedAt: true,
      complainedAt: true,
      deliveryDelayedAt: true,
      htmlSha256: true,
      attachmentSha256: true,
      _count: { select: { events: true } },
    },
  });

  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = invoice.totalTTC - totalPaid;
  const isPaid = invoice.status === "PAYE";

  // Immeubles disponibles pour rattachement (seulement si la facture n'est pas déjà liée via un bail)
  const buildingsForLink = !invoice.leaseId
    ? await prisma.building.findMany({
        where: { societyId },
        select: { id: true, name: true, addressLine1: true, postalCode: true, city: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Régime de propriété actif à la date d'émission (démembrement éventuel)
  const ownershipAtIssue = invoice.lease?.lot.id
    ? await resolveActiveOwnership(societyId, invoice.lease.lot.id, invoice.issueDate)
    : null;

  let previousBalance = 0;
  if (invoice.lease?.id) {
    const [unpaid, adjustments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          societyId,
          leaseId: invoice.lease.id,
          id: { not: invoice.id },
          status: { in: ["VALIDEE", "ENVOYEE", "EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE", "RELANCEE", "LITIGIEUX"] },
        },
        select: { totalTTC: true, payments: { select: { amount: true } } },
      }),
      prisma.tenantBalanceAdjustment.findMany({
        where: {
          societyId,
          tenantId: invoice.tenantId,
          dueDate: { lte: invoice.issueDate },
          OR: [{ leaseId: invoice.lease.id }, { leaseId: null }],
        },
        select: { amount: true },
      }),
    ]);
    previousBalance = unpaid.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      return sum + (inv.totalTTC - paid);
    }, adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0));
  }

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
          {/* Consultation — toujours visible */}
          <Link href={`/facturation/${invoice.id}/apercu`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
              Aperçu
            </Button>
          </Link>

          {/* Export PDF/Factur-X — uniquement sur les factures finalisées */}
          {invoice.status !== "BROUILLON" && (
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </a>
          )}
          {invoice.status !== "BROUILLON" && (
            <a href={`/api/invoices/${invoice.id}/facturx`} download>
              <Button variant="outline" size="sm" title="Télécharger au format Factur-X (PDF/A-3b + XML CII, conforme facturation électronique B2B)">
                <FileCode2 className="h-4 w-4" />
                Factur-X
              </Button>
            </a>
          )}

          {/* Actions BROUILLON */}
          {invoice.status === "BROUILLON" && (
            <DeleteDraftButton invoiceId={invoice.id} societyId={societyId} />
          )}
          {invoice.status === "BROUILLON" && invoice.leaseId && invoice.invoiceType === "APPEL_LOYER" && (
            <RefreshDraftButton invoiceId={invoice.id} societyId={societyId} />
          )}
          {invoice.status === "BROUILLON" && (
            <ValidateInvoiceButton invoiceId={invoice.id} societyId={societyId} />
          )}

          {/* Actions factures finalisées */}
          {isEInvoicingConfigured() && invoice.status !== "BROUILLON" && (
            <SubmitEInvoiceButton
              invoiceId={invoice.id}
              societyId={societyId}
              alreadySubmitted={
                !!invoice.einvoiceXmlUrl && !invoice.einvoiceXmlUrl.startsWith("invoices/")
              }
              flowId={
                invoice.einvoiceXmlUrl && !invoice.einvoiceXmlUrl.startsWith("invoices/")
                  ? invoice.einvoiceXmlUrl
                  : null
              }
              missingSiret={!invoice.society?.siret}
              missingEmail={!invoice.society?.email}
            />
          )}
          {!invoice.leaseId && buildingsForLink.length > 0 && (
            <LinkBuildingButton
              invoiceId={invoice.id}
              societyId={societyId}
              buildings={buildingsForLink}
              currentBuildingId={invoice.building?.id ?? null}
            />
          )}
          {invoice.status !== "BROUILLON" && (
            <SendInvoiceButton invoiceId={invoice.id} societyId={societyId} alreadySent={!!invoice.sentAt} />
          )}
          {invoice.invoiceType !== "AVOIR" && !["BROUILLON", "ANNULEE"].includes(invoice.status) && (
            <DuplicateInvoiceButton invoiceId={invoice.id} societyId={societyId} />
          )}
          {invoice.invoiceType !== "AVOIR" && invoice.creditNotes.length === 0 && !["BROUILLON", "ANNULEE"].includes(invoice.status) && (
            <Link href={`/facturation/${invoice.id}/avoir`}>
              <Button variant="outline" size="sm">
                <ReceiptText className="h-4 w-4" />
                Émettre un avoir
              </Button>
            </Link>
          )}
          {invoice.invoiceType === "AVOIR" && ["VALIDEE", "EN_ATTENTE", "ENVOYEE"].includes(invoice.status) && (
            <SettleAvoirButton invoiceId={invoice.id} societyId={societyId} />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dates */}
          <DatesEditor
            invoiceId={invoice.id}
            societyId={societyId}
            isDraft={invoice.status === "BROUILLON"}
            issueDate={invoice.issueDate.toISOString().slice(0, 10)}
            dueDate={invoice.dueDate.toISOString().slice(0, 10)}
            periodStart={invoice.periodStart ? invoice.periodStart.toISOString().slice(0, 10) : ""}
            periodEnd={invoice.periodEnd ? invoice.periodEnd.toISOString().slice(0, 10) : ""}
          />

          {/* Lignes */}
          <LinesEditor
            invoiceId={invoice.id}
            societyId={societyId}
            isDraft={invoice.status === "BROUILLON"}
            initialLines={invoice.lines.map((l) => ({
              label: l.label,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate,
              totalHT: l.totalHT,
              totalVAT: l.totalVAT,
              totalTTC: l.totalTTC,
            }))}
            totalHT={invoice.totalHT}
            totalVAT={invoice.totalVAT}
            totalTTC={invoice.totalTTC}
          />

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

          {/* Situation du compte */}
          {(previousBalance > 0 || !isPaid) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  Situation du compte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {previousBalance > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Solde précédent</span>
                    <span className="text-destructive font-medium">
                      {previousBalance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Cette facture</span>
                  <span>{invoice.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Paiements reçus</span>
                    <span className="text-green-600">− {totalPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-2 mt-1">
                  <span>Total dû</span>
                  <span className={Math.max(0, previousBalance + remaining) > 0 ? "text-destructive" : "text-green-600"}>
                    {Math.max(0, previousBalance + remaining).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

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

                {ownershipAtIssue?.snapshot.isDismembered && (
                  <div className="mt-3 rounded-md border bg-muted/30 p-2.5 space-y-1">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Crown className="h-3 w-3" />
                      Lot démembré au {invoice.issueDate.toLocaleDateString("fr-FR")}
                    </p>
                    {ownershipAtIssue.snapshot.usufruit.map((u) => (
                      <p key={u.proprietaireId} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Usufruitier&nbsp;:</span>{" "}
                        {ownershipAtIssue.proprietaires.get(u.proprietaireId)?.label ?? "—"}
                        {u.share < 1 && ` (${Math.round(u.share * 100)} %)`}
                      </p>
                    ))}
                    {ownershipAtIssue.snapshot.nuePropriete.map((n) => (
                      <p key={n.proprietaireId} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Nu-propriétaire&nbsp;:</span>{" "}
                        {ownershipAtIssue.proprietaires.get(n.proprietaireId)?.label ?? "—"}
                        {n.share < 1 && ` (${Math.round(n.share * 100)} %)`}
                      </p>
                    ))}
                    <p className="text-[11px] text-muted-foreground pt-0.5">
                      Bénéficiaire effectif du loyer : l&apos;usufruitier (art. 578 CC)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Note */}
          <NoteEditor
            invoiceId={invoice.id}
            societyId={societyId}
            initialNote={invoice.note ?? null}
          />

          <EmailDeliveryProofsCard
            proofs={deliveryProofs.map((proof) => ({
              id: proof.id,
              createdAt: proof.createdAt,
              status: proof.status,
              recipientEmail: proof.recipientEmail,
              subject: proof.subject,
              providerMessageId: proof.providerMessageId,
              deliveredAt: proof.deliveredAt,
              bouncedAt: proof.bouncedAt,
              complainedAt: proof.complainedAt,
              deliveryDelayedAt: proof.deliveryDelayedAt,
              htmlSha256: proof.htmlSha256,
              attachmentSha256: proof.attachmentSha256,
              eventsCount: proof._count.events,
            }))}
          />

          {/* Statut PA B2B */}
          {isEInvoicingConfigured() &&
            invoice.einvoiceXmlUrl &&
            !invoice.einvoiceXmlUrl.startsWith("invoices/") && (
              <PaStatusCard
                invoiceId={invoice.id}
                societyId={societyId}
                flowId={invoice.einvoiceXmlUrl}
                submittedAt={invoice.einvoiceGeneratedAt}
              />
            )}
        </div>
      </div>
    </div>
  );
}
