import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Download, MailCheck } from "lucide-react";
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

export default async function EmailDeliveryProofsPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const proofs = await prisma.emailDeliveryProof.findMany({
    where: { societyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      status: true,
      entityType: true,
      entityId: true,
      invoiceId: true,
      recipientEmail: true,
      recipientName: true,
      subject: true,
      providerMessageId: true,
      deliveredAt: true,
      bouncedAt: true,
      complainedAt: true,
      deliveryDelayedAt: true,
      attachmentSha256: true,
      _count: { select: { events: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MailCheck className="h-6 w-6" />
          Preuves d&apos;envoi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Journal transversal des emails juridiquement sensibles : factures, quittances, décomptes et courriers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique récent</CardTitle>
        </CardHeader>
        <CardContent>
          {proofs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune preuve d&apos;envoi enregistrée.</p>
          ) : (
            <div className="divide-y">
              {proofs.map((proof) => {
                const statusLabel = STATUS_LABELS[proof.status] ?? proof.status;
                const entityLabel = ENTITY_LABELS[proof.entityType] ?? proof.entityType;
                const detailHref = proof.invoiceId ? `/facturation/${proof.invoiceId}` : null;
                const lastEventAt = proof.deliveredAt ?? proof.bouncedAt ?? proof.complainedAt ?? proof.deliveryDelayedAt;

                return (
                  <div key={proof.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[proof.status] ?? "secondary"}>{statusLabel}</Badge>
                        <Badge variant="outline">{entityLabel}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(proof.createdAt)}</span>
                      </div>
                      <p className="truncate text-sm font-medium">{proof.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {proof.recipientName ? `${proof.recipientName} — ` : ""}
                        {proof.recipientEmail}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Message : {proof.providerMessageId ?? "non communiqué"}</span>
                        <span>Événements : {proof._count.events}</span>
                        <span>PDF : {proof.attachmentSha256 ? `${proof.attachmentSha256.slice(0, 10)}…` : "non disponible"}</span>
                        {lastEventAt && <span>Dernier statut : {formatDateTime(lastEventAt)}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/documents/preuves-envoi/${proof.id}`}>
                        <Button variant="outline" size="sm">Détails</Button>
                      </Link>
                      {detailHref && (
                        <Link href={detailHref}>
                          <Button variant="outline" size="sm">Voir le document</Button>
                        </Link>
                      )}
                      <a href={`/api/email-delivery-proofs/${proof.id}/pdf`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                          Attestation
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
