import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Download, MailCheck, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import {
  buildEmailDeliveryProofWhere,
  normalizeEmailDeliveryProofFilters,
  type EmailDeliveryProofSearchParams,
} from "@/lib/email-delivery-proof-filters";
import { buildEmailDeliveryProofStatusSummary, type EmailDeliveryProofStatusTone } from "@/lib/email-delivery-proof-status-summary";

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

type EmailDeliveryProofsPageProps = {
  searchParams?: Promise<EmailDeliveryProofSearchParams>;
};

function formatDateInputValue(date: Date | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function buildExportHref(filters: ReturnType<typeof normalizeEmailDeliveryProofFilters>): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status) params.set("status", filters.status);
  if (filters.entityType) params.set("type", filters.entityType);
  if (filters.from) params.set("from", formatDateInputValue(filters.from));
  if (filters.to) params.set("to", formatDateInputValue(filters.to));
  const queryString = params.toString();
  return queryString ? `/api/email-delivery-proofs/export?${queryString}` : "/api/email-delivery-proofs/export";
}

function statusSummaryClassName(tone: EmailDeliveryProofStatusTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-border bg-card text-foreground";
  }
}

export default async function EmailDeliveryProofsPage({ searchParams }: EmailDeliveryProofsPageProps) {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = normalizeEmailDeliveryProofFilters(resolvedSearchParams);
  const where = buildEmailDeliveryProofWhere(societyId, filters);
  const exportHref = buildExportHref(filters);

  const statusCounts = await prisma.emailDeliveryProof.groupBy({
    by: ["status"],
    where: { societyId },
    _count: { _all: true },
  });
  const statusSummary = buildEmailDeliveryProofStatusSummary(statusCounts);

  const proofs = await prisma.emailDeliveryProof.findMany({
    where,
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

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statusSummary.map((item) => (
          <Link
            key={item.status}
            href={`/documents/preuves-envoi?status=${item.status}`}
            className={`rounded-lg border p-4 transition-colors hover:border-primary/50 ${statusSummaryClassName(item.tone)}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-75">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.count}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Historique récent</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">{proofs.length} résultat{proofs.length > 1 ? "s" : ""}</p>
              <a href={exportHref}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exporter CSV
                </Button>
              </a>
            </div>
          </div>
          <form className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_210px_150px_150px_auto_auto] lg:items-end">
            <label className="space-y-1 text-sm font-medium">
              Recherche
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={filters.query ?? ""}
                  placeholder="Email, objet, message..."
                  className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
              </div>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Statut
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              >
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Type
              <select
                name="type"
                defaultValue={filters.entityType ?? ""}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              >
                <option value="">Tous les types</option>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Du
              <input
                type="date"
                name="from"
                defaultValue={formatDateInputValue(filters.from)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Au
              <input
                type="date"
                name="to"
                defaultValue={formatDateInputValue(filters.to)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
              />
            </label>
            <Button type="submit" className="h-10">Filtrer</Button>
            <Link href="/documents/preuves-envoi">
              <Button type="button" variant="outline" className="h-10 w-full">Réinitialiser</Button>
            </Link>
          </form>
        </CardHeader>
        <CardContent>
          {proofs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune preuve d&apos;envoi ne correspond aux critères.</p>
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
