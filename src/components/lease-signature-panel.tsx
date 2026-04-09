"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PenLine, Send, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";
import { SignatureRequestDialog } from "@/components/signature-request-dialog";

type SignatureRequest = {
  id: string;
  status: string;
  signerEmail: string;
  signerName: string;
  documentName: string;
  createdAt: string;
  signedAt?: string | null;
  declinedAt?: string | null;
  voidedAt?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  SENT: { label: "Envoye", variant: "default", icon: Send },
  DELIVERED: { label: "Remis", variant: "default", icon: Clock },
  COMPLETED: { label: "Signe", variant: "secondary", icon: CheckCircle2 },
  DECLINED: { label: "Refuse", variant: "destructive", icon: XCircle },
  VOIDED: { label: "Annule", variant: "outline", icon: Ban },
};

export function LeaseSignaturePanel({
  leaseId,
  leaseFileUrl,
  signatureRequests,
  societyId,
}: {
  leaseId: string;
  leaseFileUrl: string | null;
  signatureRequests: SignatureRequest[];
  societyId: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const hasActiveSignature = signatureRequests.some(
    (sr) => sr.status === "SENT" || sr.status === "DELIVERED"
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Signature electronique
          </CardTitle>
          {leaseFileUrl && !hasActiveSignature && (
            <SignatureRequestDialog
              documentUrl={leaseFileUrl}
              documentName="Bail"
              documentType="BAIL"
              documentId={leaseId}
              leaseId={leaseId}
              societyId={societyId}
              onSuccess={() => setRefreshKey((k) => k + 1)}
              trigger={
                <Button size="sm" variant="outline">
                  <Send className="mr-2 h-3 w-3" />
                  Envoyer a signer
                </Button>
              }
            />
          )}
        </div>
      </CardHeader>
      <CardContent key={refreshKey}>
        {signatureRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {leaseFileUrl
              ? "Aucune demande de signature. Uploadez le PDF du bail puis envoyez-le a signer."
              : "Uploadez d'abord le PDF du bail pour pouvoir l'envoyer a signer."}
          </p>
        ) : (
          <div className="space-y-3">
            {signatureRequests.map((sr) => {
              const config = STATUS_CONFIG[sr.status] ?? STATUS_CONFIG.SENT;
              const Icon = config.icon;
              return (
                <div
                  key={sr.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{sr.signerName}</p>
                    <p className="text-xs text-muted-foreground">{sr.signerEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sr.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Badge variant={config.variant} className="flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
