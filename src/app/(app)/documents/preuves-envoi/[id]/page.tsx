import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, MailCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { buildRelatedEmailDeliveryProofWhere } from "@/lib/email-delivery-proof-related";

const STATUS_LABELS: Record<string, string> = {
  SENT: "Envoyé",
  DELIVERED: "Livré",
  BOUNCED: "Rejeté",
  COMPLAINED: "Plainte",
  DELIVERY_DELAYED: "Retardé",
  FAILED: "Échec",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  SENT: "secondary",
  DELIVERED: "success",
  BOUNCED: "destructive",
  COMPLAINED: "destructive",
  DELIVERY_DELAYED: "warning",
  FAILED: "destructive",
};

const ENTITY_LABELS: Record<string, string> = {
  INVOICE: "Facture",
  RECEIPT: "Quittance",
  CHARGE_STATEMENT: "Décompte de charges",
  LETTER: "Courrier",
};

function jsonPreview(value: unknown): string {
  if (value == null) return "{}";
  return JSON.stringify(value, null, 2);
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm">{value ?? "—"}</p>
    </div>
  );
}

export default async function EmailDeliveryProofDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const { id } = await params;
  const proof = await prisma.emailDeliveryProof.findFirst({
    where: { id, societyId },
    include: {
      sentBy: { select: { name: true, email: true } },
      society: { select: { name: true, email: true, siret: true } },
      events: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!proof) notFound();

  const relatedProofs = await prisma.emailDeliveryProof.findMany({
    where: buildRelatedEmailDeliveryProofWhere({
      societyId,
      currentProofId: proof.id,
      invoiceId: proof.invoiceId,
      entityType: proof.entityType,
      entityId: proof.entityId,
    }),
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      status: true,
      recipientEmail: true,
      recipientName: true,
      subject: true,
      providerMessageId: true,
      deliveredAt: true,
      bouncedAt: true,
      complainedAt: true,
      deliveryDelayedAt: true,
      _count: { select: { events: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/documents/preuves-envoi">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <MailCheck className="h-6 w-6" />
              Preuve d&apos;envoi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{proof.subject}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={`/api/email-delivery-proofs/${proof.id}/json`}>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Archive JSON
            </Button>
          </a>
          <a href={`/api/email-delivery-proofs/${proof.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Attestation PDF
            </Button>
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Synthèse
            <Badge variant={STATUS_VARIANTS[proof.status] ?? "secondary"}>{STATUS_LABELS[proof.status] ?? proof.status}</Badge>
            <Badge variant="outline">{ENTITY_LABELS[proof.entityType] ?? proof.entityType}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Référence preuve" value={proof.id} />
          <Field label="Date d'envoi" value={formatDateTime(proof.createdAt)} />
          <Field label="Dernier statut" value={proof.lastEventAt ? formatDateTime(proof.lastEventAt) : null} />
          <Field label="Destinataire" value={`${proof.recipientName ? `${proof.recipientName} — ` : ""}${proof.recipientEmail}`} />
          <Field label="Message prestataire" value={proof.providerMessageId} />
          <Field label="Émetteur" value={proof.sentBy ? `${proof.sentBy.name ?? proof.sentBy.email} <${proof.sentBy.email}>` : null} />
          <Field label="Société" value={proof.society ? `${proof.society.name}${proof.society.siret ? ` — ${proof.society.siret}` : ""}` : null} />
          <Field label="Empreinte HTML" value={proof.htmlSha256} />
          <Field label="Empreinte pièce jointe" value={proof.attachmentSha256} />
          <Field label="Pièce jointe" value={proof.attachmentFileName} />
          <Field label="Taille pièce jointe" value={proof.attachmentSizeBytes ? `${proof.attachmentSizeBytes} octets` : null} />
          <Field label="Chemin archive" value={proof.attachmentStoragePath} />
          {proof.errorMessage && <Field label="Erreur" value={proof.errorMessage} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique lié</CardTitle>
        </CardHeader>
        <CardContent>
          {relatedProofs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun autre envoi rattaché à ce document.</p>
          ) : (
            <div className="divide-y">
              {relatedProofs.map((relatedProof) => {
                const lastEventAt =
                  relatedProof.deliveredAt ??
                  relatedProof.bouncedAt ??
                  relatedProof.complainedAt ??
                  relatedProof.deliveryDelayedAt;

                return (
                  <div key={relatedProof.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[relatedProof.status] ?? "secondary"}>
                          {STATUS_LABELS[relatedProof.status] ?? relatedProof.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(relatedProof.createdAt)}</span>
                        {lastEventAt && (
                          <span className="text-xs text-muted-foreground">Dernier statut : {formatDateTime(lastEventAt)}</span>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium">{relatedProof.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {relatedProof.recipientName ? `${relatedProof.recipientName} — ` : ""}
                        {relatedProof.recipientEmail}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Message : {relatedProof.providerMessageId ?? "non communiqué"}</span>
                        <span>Événements : {relatedProof._count.events}</span>
                      </div>
                    </div>
                    <Link href={`/documents/preuves-envoi/${relatedProof.id}`}>
                      <Button variant="outline" size="sm">Voir la preuve</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal prestataire</CardTitle>
        </CardHeader>
        <CardContent>
          {proof.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement webhook reçu.</p>
          ) : (
            <div className="space-y-4">
              {proof.events.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.eventType}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</span>
                    {event.providerEventId && <span className="text-xs text-muted-foreground">ID {event.providerEventId}</span>}
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                    {jsonPreview(event.payload)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contenu HTML archivé</CardTitle>
        </CardHeader>
        <CardContent>
          {proof.htmlSnapshot ? (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
              {proof.htmlSnapshot}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun contenu HTML archivé.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
