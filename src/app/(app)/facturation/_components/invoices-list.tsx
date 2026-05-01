"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  FilterX,
  Loader2,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceStatus, InvoiceType, TenantEntityType } from "@/generated/prisma/client";

type InvoiceItem = {
  id: string;
  invoiceNumber: string | null;
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
  building?: { id: string; name: string } | null;
  _count: { payments: number };
};

type DeliveryStatus = { status: string | null; label: string | null };

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BROUILLON: "Brouillon",
  VALIDEE: "Validée",
  ENVOYEE: "Envoyée",
  EN_ATTENTE: "En attente",
  PAYE: "Payée",
  PARTIELLEMENT_PAYE: "Part. payée",
  EN_RETARD: "En retard",
  RELANCEE: "Relancée",
  LITIGIEUX: "Litigieux",
  IRRECOUVRABLE: "Irrécouvrable",
  ANNULEE: "Annulée",
};

const STATUS_VARIANTS: Record<InvoiceStatus, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  BROUILLON: "outline",
  VALIDEE: "secondary",
  ENVOYEE: "default",
  EN_ATTENTE: "default",
  PAYE: "success",
  PARTIELLEMENT_PAYE: "warning",
  EN_RETARD: "destructive",
  RELANCEE: "destructive",
  LITIGIEUX: "destructive",
  IRRECOUVRABLE: "secondary",
  ANNULEE: "outline",
};

const TYPE_LABELS: Record<InvoiceType, string> = {
  APPEL_LOYER: "Appel loyer",
  QUITTANCE: "Quittance",
  REGULARISATION_CHARGES: "Régul. charges",
  DEPOT_DE_GARANTIE: "Dépôt garantie",
  REFACTURATION: "Refacturation",
  AVOIR: "Avoir",
};

const DELIVERY_LABELS: Record<string, string> = {
  delivered: "Transmis",
  bounced: "Rejeté",
  spam_complaint: "Spam",
  opened: "Ouvert",
  clicked: "Cliqué",
  sent: "Envoyé",
  queued: "En file",
};

const SENDABLE_STATUSES = new Set<InvoiceStatus>([
  "VALIDEE",
  "EN_ATTENTE",
  "ENVOYEE",
  "RELANCEE",
]);

function getTenantName(t: InvoiceItem["tenant"]): string {
  return t.entityType === "PERSONNE_MORALE"
    ? (t.companyName ?? "—")
    : [t.firstName, t.lastName].filter(Boolean).join(" ") || "—";
}

function getBuildingName(invoice: InvoiceItem): string {
  return invoice.lease?.lot?.building?.name ?? invoice.building?.name ?? "Sans immeuble";
}

function hasEmail(invoice: InvoiceItem): boolean {
  return !!(invoice.tenant.billingEmail || invoice.tenant.email);
}

function canSendInvoice(invoice: InvoiceItem): boolean {
  return hasEmail(invoice) && !!invoice.invoiceNumber && SENDABLE_STATUSES.has(invoice.status);
}

function getDisplayStatus(invoice: InvoiceItem): InvoiceStatus {
  if (
    invoice.invoiceType === "QUITTANCE" &&
    (invoice.status === "EN_RETARD" || invoice.status === "RELANCEE")
  ) {
    return "ENVOYEE";
  }
  return invoice.status;
}

function DeliveryBadge({ status, label }: { status: string | null; label: string | null }) {
  if (!status || !label) return null;

  if (["opened", "clicked"].includes(status)) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-status-positive)]"
        title="L’email a été ouvert par le destinataire"
      >
        <CheckCircle2 className="size-3 shrink-0" />
        {label}
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium text-primary"
        title="Accepté par le serveur du destinataire — peut être dans les spams"
      >
        <CheckCircle2 className="size-3 shrink-0" />
        {label}
      </span>
    );
  }

  if (["bounced", "spam_complaint"].includes(status)) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-status-negative)]"
        title={status === "bounced" ? "Adresse invalide ou refusé" : "Signalé comme spam"}
      >
        <XCircle className="size-3 shrink-0" />
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
      title="En attente de confirmation de livraison"
    >
      <Clock className="size-3 shrink-0" />
      {label}
    </span>
  );
}

function StatBlock({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background px-3 py-2">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

type InvoicesListProps = {
  invoices: InvoiceItem[];
  title?: string;
  listTitle?: string;
  itemLabel?: string;
  itemLabelPlural?: string;
  enableBulkSend?: boolean;
};

export function InvoicesList({
  invoices,
  title = "Console des factures",
  listTitle,
  itemLabel = "facture",
  itemLabelPlural = "factures",
  enableBulkSend = false,
}: InvoicesListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [localSentIds, setLocalSentIds] = useState<Set<string>>(new Set());
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, DeliveryStatus>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | InvoiceType>("all");
  const [buildingFilter, setBuildingFilter] = useState<"all" | string>("all");

  useEffect(() => {
    const sentInvoices = invoices.filter((invoice) => invoice.resendEmailId);
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
        const response = await fetch(`/api/invoices/${invoice.id}/email-status`);
        if (response.ok) {
          const data = await response.json() as DeliveryStatus;
          setDeliveryStatuses((prev) => ({ ...prev, [invoice.id]: data }));
        }
      } catch {
        // Statut email non critique pour l'affichage de masse.
      }
    });
  }, [invoices]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(invoices.map((invoice) => invoice.status)))
      .sort((a, b) => STATUS_LABELS[a].localeCompare(STATUS_LABELS[b], "fr"))
      .map((status) => ({ value: status, label: STATUS_LABELS[status] }));
  }, [invoices]);

  const typeOptions = useMemo(() => {
    return Array.from(new Set(invoices.map((invoice) => invoice.invoiceType)))
      .sort((a, b) => TYPE_LABELS[a].localeCompare(TYPE_LABELS[b], "fr"))
      .map((type) => ({ value: type, label: TYPE_LABELS[type] }));
  }, [invoices]);

  const buildingOptions = useMemo(() => {
    return Array.from(new Set(invoices.map((invoice) => getBuildingName(invoice))))
      .sort((a, b) => {
        if (a === "Sans immeuble") return 1;
        if (b === "Sans immeuble") return -1;
        return a.localeCompare(b, "fr");
      })
      .map((building) => ({ value: building, label: building }));
  }, [invoices]);

  const visibleInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");

    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
      if (typeFilter !== "all" && invoice.invoiceType !== typeFilter) return false;
      if (buildingFilter !== "all" && getBuildingName(invoice) !== buildingFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        invoice.invoiceNumber ?? "Brouillon",
        getTenantName(invoice.tenant),
        getBuildingName(invoice),
        TYPE_LABELS[invoice.invoiceType],
        STATUS_LABELS[getDisplayStatus(invoice)],
      ].join(" ").toLocaleLowerCase("fr-FR");

      return haystack.includes(normalizedQuery);
    });
  }, [buildingFilter, invoices, query, statusFilter, typeFilter]);

  const sortedInvoices = useMemo(() => {
    const statusRank: Partial<Record<InvoiceStatus, number>> = {
      EN_RETARD: 0,
      LITIGIEUX: 1,
      RELANCEE: 2,
      PARTIELLEMENT_PAYE: 3,
      VALIDEE: 4,
      EN_ATTENTE: 5,
      ENVOYEE: 6,
      BROUILLON: 7,
      PAYE: 8,
      IRRECOUVRABLE: 9,
      ANNULEE: 10,
    };

    return [...visibleInvoices].sort((a, b) => {
      const rankA = statusRank[a.status] ?? 99;
      const rankB = statusRank[b.status] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [visibleInvoices]);

  const visibleSendableIds = useMemo(
    () => visibleInvoices.filter(canSendInvoice).map((invoice) => invoice.id),
    [visibleInvoices]
  );

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selected.has(invoice.id)),
    [invoices, selected]
  );

  const selectedCount = selectedInvoices.length;
  const selectedTotal = selectedInvoices.reduce((sum, invoice) => sum + invoice.totalTTC, 0);
  const totalVisible = visibleInvoices.reduce((sum, invoice) => sum + invoice.totalTTC, 0);
  const sentCount = invoices.filter((invoice) => invoice.sentAt || localSentIds.has(invoice.id)).length;
  const missingEmailCount = visibleInvoices.filter((invoice) => !hasEmail(invoice)).length;
  const allVisibleSelected =
    visibleSendableIds.length > 0 &&
    visibleSendableIds.every((id) => selected.has(id));

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setBuildingFilter("all");
  };

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (visibleSendableIds.every((id) => next.has(id))) {
        visibleSendableIds.forEach((id) => next.delete(id));
      } else {
        visibleSendableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleSendableIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendBulk = async () => {
    const ids = selectedInvoices.map((invoice) => invoice.id);
    setSending(true);
    let ok = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const response = await fetch(`/api/invoices/${id}/send-email`, { method: "POST" });
        if (response.ok) {
          ok++;
          setLocalSentIds((prev) => new Set([...prev, id]));
          setDeliveryStatuses((prev) => ({ ...prev, [id]: { status: "sent", label: "Envoyé" } }));
        } else {
          const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
          const invoice = invoices.find((item) => item.id === id);
          const msg = body?.error?.message ?? `Erreur HTTP ${response.status}`;
          errors.push(`${invoice?.invoiceNumber ?? id} : ${msg}`);
        }
      } catch (err) {
        const invoice = invoices.find((item) => item.id === id);
        errors.push(`${invoice?.invoiceNumber ?? id} : ${String(err)}`);
      }
    }

    setSending(false);
    setSelected(new Set());
    if (ok > 0) toast.success(`${ok} email${ok > 1 ? "s" : ""} envoyé${ok > 1 ? "s" : ""}`);
    if (errors.length > 0) toast.error(errors.join(" | "), { duration: 10000 });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {visibleInvoices.length} {visibleInvoices.length > 1 ? itemLabelPlural : itemLabel} affichée{visibleInvoices.length > 1 ? "s" : ""} sur {invoices.length}
              </p>
            </div>
            {enableBulkSend && (
              <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[30rem]">
                <StatBlock
                  label="Total affiché"
                  value={formatCurrency(totalVisible)}
                  detail={`${visibleSendableIds.length} envoyable${visibleSendableIds.length > 1 ? "s" : ""}`}
                />
                <StatBlock
                  label="Déjà envoyées"
                  value={String(sentCount)}
                  detail="emails ou dépôt PDF"
                />
                <StatBlock
                  label="Emails manquants"
                  value={String(missingEmailCount)}
                  detail="dans la vue filtrée"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem_14rem_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher facture, locataire, immeuble..."
                className="pl-9"
              />
            </div>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | InvoiceStatus)}
              options={[{ value: "all", label: "Tous les statuts" }, ...statusOptions]}
              aria-label="Filtrer par statut"
            />
            <NativeSelect
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "all" | InvoiceType)}
              options={[{ value: "all", label: "Tous les types" }, ...typeOptions]}
              aria-label="Filtrer par type"
            />
            <NativeSelect
              value={buildingFilter}
              onChange={(event) => setBuildingFilter(event.target.value)}
              options={[{ value: "all", label: "Tous les immeubles" }, ...buildingOptions]}
              aria-label="Filtrer par immeuble"
            />
            <Button type="button" variant="outline" onClick={resetFilters}>
              <FilterX className="size-4" />
              Réinitialiser
            </Button>
          </div>

          {enableBulkSend && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleAllVisible}
                disabled={visibleSendableIds.length === 0 || sending}
                id="select-visible-invoices"
                aria-label={`Sélectionner les ${itemLabelPlural} envoyables affichées`}
              />
              <label htmlFor="select-visible-invoices" className="cursor-pointer select-none text-sm">
                Sélectionner les factures envoyables
              </label>
              <span className="text-xs text-muted-foreground">
                {visibleSendableIds.length} disponible{visibleSendableIds.length > 1 ? "s" : ""}
              </span>
              {selectedCount > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(selectedTotal)}</span>
                  <Button size="sm" onClick={sendBulk} disabled={sending}>
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {sending ? "Envoi..." : "Envoyer"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={sending}>
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {visibleInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Aucune {itemLabel} dans cette vue</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Modifiez la recherche ou les filtres pour retrouver vos factures.
              </p>
            </div>
            <Button variant="outline" onClick={resetFilters}>
              <FilterX className="size-4" />
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-muted-foreground" />
              {listTitle ?? `Registre des ${itemLabelPlural}`}
              <Badge variant="outline" className="ml-auto">
                {sortedInvoices.length} {sortedInvoices.length > 1 ? itemLabelPlural : itemLabel}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {sortedInvoices.map((invoice) => {
                const isSent = !!invoice.sentAt || localSentIds.has(invoice.id);
                const delivery = deliveryStatuses[invoice.id] ?? null;
                const displayStatus = getDisplayStatus(invoice);
                const sendable = canSendInvoice(invoice);
                const buildingName = getBuildingName(invoice);

                return (
                  <div
                    key={invoice.id}
                    className={`grid gap-3 px-4 py-3 transition-colors hover:bg-accent/30 ${
                      enableBulkSend
                        ? "md:grid-cols-[auto_minmax(0,1fr)_auto]"
                        : "md:grid-cols-[minmax(0,1fr)_auto]"
                    }`}
                  >
                    {enableBulkSend && (
                      <Checkbox
                        checked={selected.has(invoice.id)}
                        onCheckedChange={() => toggleOne(invoice.id)}
                        disabled={!sendable || sending}
                        title={!hasEmail(invoice) ? "Aucun email pour ce locataire" : !sendable ? "Statut non envoyable" : undefined}
                        aria-label={`Sélectionner ${invoice.invoiceNumber ?? `${itemLabel} sans numéro`}`}
                        className="mt-1"
                      />
                    )}
                    <Link href={`/facturation/${invoice.id}`} className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{invoice.invoiceNumber ?? "Sans numéro"}</p>
                        {isSent && delivery?.status && (
                          <DeliveryBadge status={delivery.status} label={delivery.label} />
                        )}
                        {isSent && !delivery?.status && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-status-positive)]">
                            <CheckCircle2 className="size-3 shrink-0" />
                            Envoyé
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{getTenantName(invoice.tenant)}</span>
                        <span>· échéance {formatDate(invoice.dueDate)}</span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Building2 className="size-3 shrink-0" />
                          <span className="truncate">{buildingName}</span>
                        </span>
                        {isSent && invoice.sentAt ? <span>· envoyé le {formatDate(invoice.sentAt)}</span> : null}
                      </p>
                    </Link>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <div className="text-left md:text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(invoice.totalTTC)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(invoice.totalHT)} HT</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[invoice.invoiceType]}</Badge>
                        <Badge variant={STATUS_VARIANTS[displayStatus]} className="text-xs">
                          {STATUS_LABELS[displayStatus]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
