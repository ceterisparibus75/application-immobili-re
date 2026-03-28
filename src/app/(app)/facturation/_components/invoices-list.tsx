"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Mail, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceStatus, InvoiceType, TenantEntityType } from "@/generated/prisma/client";

type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  dueDate: Date;
  totalTTC: number;
  totalHT: number;
  sentAt: Date | null;
  resendEmailId: string | null;
  emailDeliveryStatus: string | null;
  tenant: {
    id: string;
    entityType: TenantEntityType;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    billingEmail?: string | null;
  };
  lease?: { lot?: { building?: { id: string; name: string } | null } | null } | null;
  _count: { payments: number };
};

type DeliveryStatus = { status: string | null; label: string | null };

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: "Brouillon", VALIDEE: "Validée", ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente", PAYE: "Payée", PARTIELLEMENT_PAYE: "Part. payée",
  EN_RETARD: "En retard", RELANCEE: "Relancée", LITIGIEUX: "Litigieux",
  IRRECOUVRABLE: "Irrécouvrable", ANNULEE: "Annulée",
};

const STATUS_VARIANTS: Record<InvoiceStatus, "default"|"success"|"warning"|"destructive"|"secondary"|"outline"> = {
  BROUILLON: "outline", VALIDEE: "secondary", ENVOYEE: "default",
  EN_ATTENTE: "default", PAYE: "success", PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive", RELANCEE: "destructive", LITIGIEUX: "destructive",
  IRRECOUVRABLE: "secondary", ANNULEE: "outline",
};

const TYPE_LABELS: Record<InvoiceType, string> = {
  APPEL_LOYER: "Appel loyer", QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régul. charges", REFACTURATION: "Refacturation", AVOIR: "Avoir",
};

const DELIVERY_LABELS: Record<string, string> = {
  delivered: "Transmis", bounced: "Rejeté", spam_complaint: "Spam",
  opened: "Ouvert", clicked: "Cliqué", sent: "Envoyé", queued: "En file",
};

function getTenantName(t: InvoiceItem["tenant"]): string {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : [t.firstName, t.lastName].filter(Boolean).join(" ") || "—";
}

function getBuildingName(invoice: InvoiceItem): string {
  return invoice.lease?.lot?.building?.name ?? "Sans immeuble";
}

function hasEmail(invoice: InvoiceItem): boolean {
  return !!(invoice.tenant.billingEmail || invoice.tenant.email);
}

function DeliveryBadge({ status, label }: { status: string | null; label: string | null }) {
  if (!status || !label) return null;

  // opened/clicked = confirmed inbox delivery
  if (["opened", "clicked"].includes(status)) {
    return (
      <span
        className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-medium"
        title="L’email a été ouvert par le destinataire"
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" />{label}
      </span>
    );
  }

  // delivered = accepted by MX server, NOT guaranteed inbox
  if (status === "delivered") {
    return (
      <span
        className="flex items-center gap-0.5 text-blue-500 text-[10px] font-medium"
        title="Accepté par le serveur du destinataire — peut être dans les spams"
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" />{label}
      </span>
    );
  }

  if (["bounced", "spam_complaint"].includes(status)) {
    return (
      <span
        className="flex items-center gap-0.5 text-red-500 text-[10px] font-medium"
        title={status === "bounced" ? "Adresse invalide ou refusé" : "Signalé comme spam"}
      >
        <XCircle className="h-3 w-3 shrink-0" />{label}
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-0.5 text-muted-foreground text-[10px]"
      title="En attente de confirmation de livraison"
    >
      <Clock className="h-3 w-3 shrink-0" />{label}
    </span>
  );
}


export function InvoicesList({ invoices }: { invoices: InvoiceItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [localSentIds, setLocalSentIds] = useState<Set<string>>(new Set());
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, DeliveryStatus>>({});

  useEffect(() => {
    const sentInvoices = invoices.filter((i) => i.resendEmailId);
    if (sentInvoices.length === 0) return;
    sentInvoices.forEach(async (invoice) => {
      if (
        invoice.emailDeliveryStatus &&
        ["delivered", "bounced", "spam_complaint"].includes(invoice.emailDeliveryStatus)
      ) {
        setDeliveryStatuses((prev) => ({
          ...prev,
          [invoice.id]: {
            status: invoice.emailDeliveryStatus,
            label: DELIVERY_LABELS[invoice.emailDeliveryStatus!] ?? invoice.emailDeliveryStatus,
          },
        }));
        return;
      }
      try {
        const r = await fetch(`/api/invoices/${invoice.id}/email-status`);
        if (r.ok) {
          const data = await r.json() as DeliveryStatus;
          setDeliveryStatuses((prev) => ({ ...prev, [invoice.id]: data }));
        }
      } catch {
        // ignore
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byBuilding: [string, InvoiceItem[]][] = Object.entries(
    invoices.reduce<Record<string, InvoiceItem[]>>((acc, inv) => {
      const key = getBuildingName(inv);
      if (!acc[key]) acc[key] = [];
      acc[key].push(inv);
      return acc;
    }, {})
  )
    .sort(([a], [b]) => {
      if (a === "Sans immeuble") return 1;
      if (b === "Sans immeuble") return -1;
      return a.localeCompare(b, "fr");
    })
    .map(([name, invs]) => [
      name,
      [...invs].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    ]);

  const sendableIds = invoices.filter(hasEmail).map((i) => i.id);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === sendableIds.length) return new Set();
      return new Set(sendableIds);
    });
  }, [sendableIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendBulk = async () => {
    const ids = Array.from(selected);
    setSending(true);
    let ok = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        const r = await fetch(`/api/invoices/${id}/send-email`, { method: "POST" });
        if (r.ok) {
          ok++;
          setLocalSentIds((prev) => new Set([...prev, id]));
          setDeliveryStatuses((prev) => ({ ...prev, [id]: { status: "sent", label: "Envoyé" } }));
        } else {
          const body = await r.json().catch(() => ({})) as { error?: { message?: string } };
          const inv = invoices.find((i) => i.id === id);
          const msg = body?.error?.message ?? `Erreur HTTP ${r.status}`;
          errors.push(`${inv?.invoiceNumber ?? id} : ${msg}`);
        }
      } catch (err) {
        const inv = invoices.find((i) => i.id === id);
        errors.push(`${inv?.invoiceNumber ?? id} : ${String(err)}`);
      }
    }
    setSending(false);
    setSelected(new Set());
    if (ok > 0) toast.success(`${ok} email${ok > 1 ? "s" : ""} envoyé${ok > 1 ? "s" : ""}`);
    if (errors.length > 0) toast.error(errors.join(" | "), { duration: 10000 });
    router.refresh();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-1 flex-wrap">
        <Checkbox
          checked={sendableIds.length > 0 && selected.size === sendableIds.length}
          onCheckedChange={toggleAll}
          id="select-all"
          aria-label="Tout sélectionner"
        />
        <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
          Tout sélectionner ({sendableIds.length} avec email)
        </label>
        {selected.size > 0 && (
          <>
            <span className="text-xs font-medium">
              {selected.size} sélectionné{selected.size > 1 ? "es" : "e"}
            </span>
            <Button size="sm" onClick={sendBulk} disabled={sending}>
              {sending ? (<Loader2 className="h-4 w-4 mr-2 animate-spin" />) : (<Mail className="h-4 w-4 mr-2" />)}
              {sending ? "Envoi en cours..." : "Envoyer par mail"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={sending}>
              Annuler
            </Button>
          </>
        )}
      </div>

      {byBuilding.map(([buildingName, invs]) => (
        <Card key={buildingName}>
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              {buildingName}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {invs.length} facture{invs.length > 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invs.map((invoice) => {
                const isSent = !!(invoice.sentAt) || localSentIds.has(invoice.id);
                const delivery = deliveryStatuses[invoice.id] ?? null;
                return (
                  <div key={invoice.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                  <Checkbox
                    checked={selected.has(invoice.id)}
                    onCheckedChange={() => toggleOne(invoice.id)}
                    disabled={!hasEmail(invoice) || sending}
                    title={!hasEmail(invoice) ? "Aucun email pour ce locataire" : undefined}
                    aria-label={`Sélectionner ${invoice.invoiceNumber}`}
                  />
                  <Link
                    href={`/facturation/${invoice.id}`}
                    className="flex flex-1 items-center justify-between min-w-0 gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                        {isSent && delivery?.status && (
                          <DeliveryBadge status={delivery.status} label={delivery.label} />
                        )}
                        {isSent && !delivery?.status && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-label="Email envoyé" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {getTenantName(invoice.tenant)} — {formatDate(invoice.dueDate)}
                        {isSent && invoice.sentAt && (
                          <span className="ml-1 text-emerald-600">· envoyé le {formatDate(invoice.sentAt)}</span>
                        )}
                        {isSent && !invoice.sentAt && localSentIds.has(invoice.id) && (
                          <span className="ml-1 text-emerald-600">· envoyé</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{formatCurrency(invoice.totalTTC)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(invoice.totalHT)} HT</p>
                      </div>
                      <Badge variant="outline" className="text-xs hidden md:flex">{TYPE_LABELS[invoice.invoiceType]}</Badge>
                      <Badge variant={STATUS_VARIANTS[invoice.status]} className="text-xs">{STATUS_LABELS[invoice.status]}</Badge>
                    </div>
                  </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
