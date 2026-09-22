"use client";

import Link from "next/link";
import { AlertOctagon, Mail, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export type FailedInvoiceDeliveryItem = {
  invoiceId: string;
  invoiceNumber: string | null;
  status: "BOUNCED" | "COMPLAINED" | "FAILED";
  recipientEmail: string;
  recipientName: string | null;
  failedAt: string; // ISO
  errorMessage: string | null;
  tenantId: string | null;
  tenantName: string;
  buildingName: string | null;
};

const STATUS_LABELS: Record<FailedInvoiceDeliveryItem["status"], string> = {
  BOUNCED: "Rejeté",
  COMPLAINED: "Plainte",
  FAILED: "Échec",
};

export function FailedDeliverySection({ items }: { items: FailedInvoiceDeliveryItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card className="border-[var(--color-status-negative)]/25 bg-[var(--color-status-negative-bg)]/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertOctagon className="h-5 w-5 text-[var(--color-status-negative)]" />
          Emails non délivrés ({items.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ces factures ont bien été envoyées, mais le serveur du destinataire a rejeté l&apos;email.
          Le locataire ne l&apos;a jamais reçu — corrige l&apos;adresse puis renvoie.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border/60">
          {items.map((item) => (
            <div key={item.invoiceId} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">{STATUS_LABELS[item.status]}</Badge>
                  <span className="text-sm font-medium">
                    {item.invoiceNumber ?? "Sans numéro"}
                    {item.buildingName && (
                      <span className="text-muted-foreground font-normal"> — {item.buildingName}</span>
                    )}
                  </span>
                </div>
                <div className="text-sm">
                  {item.tenantName}
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-mono text-xs">{item.recipientEmail}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(new Date(item.failedAt))}
                  {item.errorMessage && ` — ${item.errorMessage}`}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {item.tenantId && (
                  <Link href={`/locataires/${item.tenantId}/modifier`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-4 w-4" />
                      Corriger l&apos;adresse
                    </Button>
                  </Link>
                )}
                <Link href={`/facturation/${item.invoiceId}`}>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4" />
                    Voir la facture
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
