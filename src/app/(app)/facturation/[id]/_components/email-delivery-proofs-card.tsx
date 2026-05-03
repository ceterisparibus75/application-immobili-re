import { AlertTriangle, CheckCircle2, Clock3, Download, MailCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export type EmailDeliveryProofListItem = {
  id: string;
  createdAt: Date;
  status: string;
  recipientEmail: string;
  subject: string;
  providerMessageId: string | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  deliveryDelayedAt: Date | null;
  htmlSha256: string | null;
  attachmentSha256: string | null;
  eventsCount: number;
};

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary"; icon: typeof Clock3 }> = {
  SENT: { label: "Envoyé", variant: "secondary", icon: Clock3 },
  DELIVERED: { label: "Livré", variant: "success", icon: CheckCircle2 },
  BOUNCED: { label: "Rejeté", variant: "destructive", icon: AlertTriangle },
  COMPLAINED: { label: "Plainte", variant: "destructive", icon: AlertTriangle },
  DELIVERY_DELAYED: { label: "Retardé", variant: "warning", icon: Clock3 },
  FAILED: { label: "Échec", variant: "destructive", icon: AlertTriangle },
};

function shortHash(hash: string | null): string {
  return hash ? `${hash.slice(0, 10)}…` : "non disponible";
}

function statusDate(proof: EmailDeliveryProofListItem): Date | null {
  return proof.deliveredAt ?? proof.bouncedAt ?? proof.complainedAt ?? proof.deliveryDelayedAt;
}

export function EmailDeliveryProofsCard({ proofs }: { proofs: EmailDeliveryProofListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="h-4 w-4" />
          Preuves d&apos;envoi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {proofs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun envoi historisé pour cette facture.</p>
        ) : (
          <div className="space-y-3">
            {proofs.map((proof) => {
              const meta = STATUS_META[proof.status] ?? STATUS_META.SENT;
              const Icon = meta.icon;
              const eventDate = statusDate(proof);

              return (
                <div key={proof.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meta.variant}>
                          <Icon className="mr-1 h-3 w-3" />
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Envoyé le {formatDateTime(proof.createdAt)}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium">{proof.subject}</p>
                      <p className="text-xs text-muted-foreground">{proof.recipientEmail}</p>
                      <div className="grid gap-1 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>Message : {proof.providerMessageId ?? "non communiqué"}</span>
                        <span>Événements : {proof.eventsCount}</span>
                        <span>HTML : {shortHash(proof.htmlSha256)}</span>
                        <span>PDF : {shortHash(proof.attachmentSha256)}</span>
                        {eventDate && <span className="sm:col-span-2">Dernier statut : {formatDateTime(eventDate)}</span>}
                      </div>
                    </div>
                    <a href={`/api/email-delivery-proofs/${proof.id}/pdf`} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                        Attestation PDF
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
  );
}
