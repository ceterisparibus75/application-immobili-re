import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, MailCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

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
        <a href={`/api/email-delivery-proofs/${proof.id}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Attestation PDF
          </Button>
        </a>
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
