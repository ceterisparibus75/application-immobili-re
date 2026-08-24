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
  Download,
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

function canDownloadInvoice(invoice: InvoiceItem): boolean {
  return !!invoice.invoiceNumber;
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

// ── Filtre par période (sur invoice.dueDate) ──────────────────────────────

type PeriodPreset =
  | "all"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "custom";

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Toutes les périodes" },
  { value: "this_month", label: "Ce mois-ci" },
  { value: "last_month", label: "Mois dernier" },
  { value: "this_quarter", label: "Ce trimestre" },
  { value: "this_year", label: "Cette année" },
  { value: "last_year", label: "Année dernière" },
  { value: "custom", label: "Personnalisée…" },
];

function computePeriodRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  now: Date = new Date()
): { from: Date | null; to: Date | null } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "all":
      return { from: null, to: null };
    case "this_month":
      return {
        from: new Date(y, m, 1),
        to: new Date(y, m + 1, 0, 23, 59, 59, 999),
      };
    case "last_month":
      return {
        from: new Date(y, m - 1, 1),
        to: new Date(y, m, 0, 23, 59, 59, 999),
      };
    case "this_quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return {
        from: new Date(y, qStart, 1),
        to: new Date(y, qStart + 3, 0, 23, 59, 59, 999),
      };
    }
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999) };
    case "last_year":
      return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
    case "custom": {
      const fromDate = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
      const toDate = customTo ? new Date(`${customTo}T23:59:59.999`) : null;
      return { from: fromDate, to: toDate };
    }
  }
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
  enableBulkDownload?: boolean;
};

export function InvoicesList({
  invoices,
  title = "Console des factures",
  listTitle,
  itemLabel = "facture",
  itemLabelPlural = "factures",
  enableBulkSend = false,
  enableBulkDownload = false,
}: InvoicesListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const enableSelection = enableBulkSend || enableBulkDownload;
  const [localSentIds, setLocalSentIds] = useState<Set<string>>(new Set());
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, DeliveryStatus>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | InvoiceType>("all");
  const [buildingFilter, setBuildingFilter] = useState<"all" | string>("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

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

  const periodRange = useMemo(
    () => computePeriodRange(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const visibleInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
    const { from: periodFrom, to: periodTo } = periodRange;

    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) return false;
      if (typeFilter !== "all" && invoice.invoiceType !== typeFilter) return false;
      if (buildingFilter !== "all" && getBuildingName(invoice) !== buildingFilter) return false;
      if (periodFrom || periodTo) {
        const due = new Date(invoice.dueDate).getTime();
        if (periodFrom && due < periodFrom.getTime()) return false;
        if (periodTo && due > periodTo.getTime()) return false;
      }
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
  }, [buildingFilter, invoices, periodRange, query, statusFilter, typeFilter]);

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

  const visibleSelectableIds = useMemo(() => {
    if (enableBulkSend) return visibleInvoices.filter(canSendInvoice).map((i) => i.id);
    if (enableBulkDownload) return visibleInvoices.filter(canDownloadInvoice).map((i) => i.id);
    return [];
  }, [enableBulkSend, enableBulkDownload, visibleInvoices]);

  const isInvoiceSelectable = useCallback(
    (invoice: InvoiceItem): boolean => {
      if (enableBulkSend) return canSendInvoice(invoice);
      if (enableBulkDownload) return canDownloadInvoice(invoice);
      return false;
    },
    [enableBulkSend, enableBulkDownload]
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
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selected.has(id));

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setBuildingFilter("all");
    setPeriodPreset("all");
    setCustomFrom("");
    setCustomTo("");
  };

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (visibleSelectableIds.every((id) => next.has(id))) {
        visibleSelectableIds.forEach((id) => next.delete(id));
      } else {
        visibleSelectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleSelectableIds]);

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

  const downloadBulk = async () => {
    if (selectedInvoices.length === 0) return;
    setDownloading(true);
    try {
      const JSZipModule = await import("jszip");
      const zip = new JSZipModule.default();
      const errors: string[] = [];

      // Rate limit backend : 10 req/10s. On reste conservateur avec 2 en parallèle
      // + petit délai entre batches. Sur 429, on retente avec backoff exponentiel
      // pour éviter les échecs partiels sur les gros téléchargements.
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const fetchOneWithRetry = async (invoice: InvoiceItem, attempt = 0): Promise<void> => {
        try {
          const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
          if (response.status === 429 && attempt < 4) {
            // Respecter Retry-After si présent, sinon backoff 1s, 2s, 4s, 8s
            const retryHeader = response.headers.get("retry-after");
            const retryMs = retryHeader
              ? Math.max(1000, parseInt(retryHeader, 10) * 1000)
              : 1000 * Math.pow(2, attempt);
            await sleep(retryMs);
            return fetchOneWithRetry(invoice, attempt + 1);
          }
          if (!response.ok) {
            errors.push(`${invoice.invoiceNumber ?? invoice.id} : HTTP ${response.status}`);
            return;
          }
          const blob = await response.blob();
          // Le serveur fixe déjà le nom canonique {numero}_{adresse}_{locataire}_{periode}.pdf
          // dans Content-Disposition — on le réutilise pour la cohérence avec les autres exports.
          const disposition = response.headers.get("content-disposition") ?? "";
          const dispoMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
          const fallback = `${(invoice.invoiceNumber ?? invoice.id).replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
          const filename = dispoMatch?.[1] ? decodeURIComponent(dispoMatch[1]) : fallback;
          zip.file(filename, blob);
        } catch (err) {
          errors.push(`${invoice.invoiceNumber ?? invoice.id} : ${String(err)}`);
        }
      };

      const batchSize = 2;
      const interBatchDelayMs = 400;
      for (let i = 0; i < selectedInvoices.length; i += batchSize) {
        await Promise.all(selectedInvoices.slice(i, i + batchSize).map((inv) => fetchOneWithRetry(inv)));
        if (i + batchSize < selectedInvoices.length) {
          await sleep(interBatchDelayMs);
        }
      }

      const fileCount = Object.keys(zip.files).length;
      if (fileCount === 0) {
        toast.error("Aucun PDF récupéré");
      } else {
        const archive = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(archive);
        const link = document.createElement("a");
        link.href = url;
        const stamp = new Date().toISOString().slice(0, 10);
        link.download = `factures-${stamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`${fileCount} ${itemLabelPlural} téléchargée${fileCount > 1 ? "s" : ""}`);
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} échec(s) : ${errors.slice(0, 3).join(" | ")}`, { duration: 10000 });
      }
    } finally {
      setDownloading(false);
    }
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
          <div className="grid gap-2 xl:grid-cols-[minmax(14rem,1fr)_10rem_10rem_12rem_12rem_auto]">
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
            <NativeSelect
              value={periodPreset}
              onChange={(event) => setPeriodPreset(event.target.value as PeriodPreset)}
              options={PERIOD_OPTIONS}
              aria-label="Filtrer par période"
            />
            <Button type="button" variant="outline" onClick={resetFilters}>
              <FilterX className="size-4" />
              Réinitialiser
            </Button>
          </div>
          {periodPreset === "custom" && (
            <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center rounded-md border bg-muted/20 px-3 py-2">
              <label htmlFor="period-from" className="text-xs text-muted-foreground">
                Du
              </label>
              <Input
                id="period-from"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                aria-label="Date de début de période"
              />
              <label htmlFor="period-to" className="text-xs text-muted-foreground">
                Au
              </label>
              <Input
                id="period-to"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                aria-label="Date de fin de période"
              />
            </div>
          )}
          {periodPreset !== "all" && periodPreset !== "custom" && (
            <p className="text-[11px] text-muted-foreground">
              Filtrage sur la date d&apos;échéance des factures ({PERIOD_OPTIONS.find((p) => p.value === periodPreset)?.label.toLowerCase()}).
            </p>
          )}

          {enableSelection && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleAllVisible}
                disabled={visibleSelectableIds.length === 0 || sending || downloading}
                id="select-visible-invoices"
                aria-label={`Sélectionner les ${itemLabelPlural} affichées`}
              />
              <label htmlFor="select-visible-invoices" className="cursor-pointer select-none text-sm">
                {enableBulkSend ? "Sélectionner les factures envoyables" : `Sélectionner les ${itemLabelPlural}`}
              </label>
              <span className="text-xs text-muted-foreground">
                {visibleSelectableIds.length} disponible{visibleSelectableIds.length > 1 ? "s" : ""}
              </span>
              {selectedCount > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(selectedTotal)}</span>
                  {enableBulkSend && (
                    <Button size="sm" onClick={sendBulk} disabled={sending || downloading}>
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {sending ? "Envoi..." : "Envoyer"}
                    </Button>
                  )}
                  {enableBulkDownload && (
                    <Button size="sm" variant={enableBulkSend ? "outline" : "default"} onClick={downloadBulk} disabled={sending || downloading}>
                      {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      {downloading ? "Préparation..." : "Télécharger (ZIP)"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={sending || downloading}>
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
                const buildingName = getBuildingName(invoice);
                const selectable = isInvoiceSelectable(invoice);
                return (
                  <div
                    key={invoice.id}
                    className={`grid gap-3 px-4 py-3 transition-colors hover:bg-accent/30 ${
                      enableSelection
                        ? "md:grid-cols-[auto_minmax(0,1fr)_auto]"
                        : "md:grid-cols-[minmax(0,1fr)_auto]"
                    }`}
                  >
                    {enableSelection && (
                      <Checkbox
                        checked={selected.has(invoice.id)}
                        onCheckedChange={() => toggleOne(invoice.id)}
                        disabled={!selectable || sending || downloading}
                        title={
                          enableBulkSend && !hasEmail(invoice)
                            ? "Aucun email pour ce locataire"
                            : !selectable
                              ? (enableBulkSend ? "Statut non envoyable" : "Aucun numéro de facture")
                              : undefined
                        }
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
