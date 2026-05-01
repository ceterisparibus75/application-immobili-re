"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Bell, FilterX, Loader2, Mail, MailX, Search } from "lucide-react";
import { sendManualReminder, sendBulkReminders } from "@/actions/reminder";
import { toast } from "sonner";
import type { ReminderLevel } from "@/generated/prisma/client";

const LEVEL_OPTIONS: { value: ReminderLevel; label: string }[] = [
  { value: "RELANCE_1", label: "1ère relance (amiable)" },
  { value: "RELANCE_2", label: "2ème relance (formelle)" },
  { value: "MISE_EN_DEMEURE", label: "Mise en demeure" },
];

interface OverdueInvoice {
  id: string;
  invoiceNumber: string | null;
  totalTTC: number;
  dueDate: string;
  status: string;
  paid: number;
  tenantName: string;
  tenantEmail: string | null;
}

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function getDefaultLevel(daysLate: number): ReminderLevel {
  if (daysLate >= 30) return "MISE_EN_DEMEURE";
  if (daysLate >= 15) return "RELANCE_2";
  return "RELANCE_1";
}

export function RelancesOverdue({
  societyId,
  overdueInvoices,
}: {
  societyId: string;
  overdueInvoices: OverdueInvoice[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLevel, setBulkLevel] = useState<ReminderLevel>("RELANCE_1");
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr-FR");
    if (!normalized) return overdueInvoices;

    return overdueInvoices.filter((invoice) => {
      const haystack = [
        invoice.invoiceNumber ?? "",
        invoice.tenantName,
        invoice.tenantEmail ?? "",
      ].join(" ").toLocaleLowerCase("fr-FR");
      return haystack.includes(normalized);
    });
  }, [overdueInvoices, query]);

  const sendableIds = useMemo(
    () => filteredInvoices.filter((invoice) => invoice.tenantEmail).map((invoice) => invoice.id),
    [filteredInvoices]
  );

  const selectedInvoices = useMemo(
    () => filteredInvoices.filter((invoice) => selectedIds.has(invoice.id)),
    [filteredInvoices, selectedIds]
  );

  const selectedTotal = selectedInvoices.reduce((sum, invoice) => sum + invoice.totalTTC - invoice.paid, 0);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (sendableIds.every((id) => next.has(id))) {
        sendableIds.forEach((id) => next.delete(id));
      } else {
        sendableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleBulkSend() {
    const ids = selectedInvoices.map((invoice) => invoice.id);
    if (ids.length === 0) return;
    setSending(true);
    const result = await sendBulkReminders(
      societyId,
      ids,
      bulkLevel
    );
    setSending(false);
    if (result.success) {
      const { sent, failed } = result.data!;
      if (failed > 0) {
        toast.warning(
          `${sent} relance${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}, ${failed} échec${failed > 1 ? "s" : ""}`
        );
      } else {
        toast.success(
          `${sent} relance${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}`
        );
      }
      setSelectedIds(new Set());
    } else {
      toast.error(result.error ?? "Erreur lors de l'envoi");
    }
  }

  async function handleSingleSend(inv: OverdueInvoice) {
    const daysLate = Math.floor(
      (now - new Date(inv.dueDate).getTime()) / 86400000
    );
    const level = getDefaultLevel(daysLate);

    setSendingId(inv.id);
    const result = await sendManualReminder(societyId, inv.id, level);
    setSendingId(null);

    if (result.success) {
      toast.success(`Relance envoyée à ${inv.tenantName}`);
    } else {
      toast.error(result.error ?? "Erreur lors de l'envoi");
    }
  }

  const allSelected =
    sendableIds.length > 0 &&
    sendableIds.every((id) => selectedIds.has(id));
  const someSelected = selectedInvoices.length > 0;

  if (overdueInvoices.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm font-medium">Aucune facture en retard</p>
        <p className="text-xs text-muted-foreground mt-1">
          Les factures impayées apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[minmax(14rem,1fr)_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher locataire, facture, email..."
            className="h-9 pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setQuery("")} disabled={!query}>
          <FilterX className="h-4 w-4" />
          Réinitialiser
        </Button>
      </div>

      {/* Barre d'actions groupées */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            disabled={sendableIds.length === 0 || sending}
            aria-label="Tout sélectionner"
            className="h-4 w-4"
          />
          <span className="text-xs text-muted-foreground">
            {someSelected
              ? `${selectedInvoices.length} sélectionné${selectedInvoices.length > 1 ? "s" : ""} · ${fmt(selectedTotal)}`
              : `Sélectionner les relançables (${sendableIds.length})`}
          </span>
        </div>

        {someSelected && (
          <>
            <Select
              value={bulkLevel}
              onValueChange={(v) => setBulkLevel(v as ReminderLevel)}
            >
              <SelectTrigger className="h-7 text-xs w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={o.value}
                    className="text-xs"
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => void handleBulkSend()}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Envoyer {selectedInvoices.length} relance
              {selectedInvoices.length > 1 ? "s" : ""}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedIds(new Set())}
              disabled={sending}
            >
              Désélectionner
            </Button>
          </>
        )}
      </div>

      {/* Liste des factures */}
      <div className="divide-y">
        {filteredInvoices.map((inv) => {
          const daysLate = Math.floor(
            (now - new Date(inv.dueDate).getTime()) / 86400000
          );
          const remaining = inv.totalTTC - inv.paid;
          const isSelected = selectedIds.has(inv.id);
          const isSending = sendingId === inv.id;
          const hasEmail = !!inv.tenantEmail;

          return (
            <div
              key={inv.id}
              className={`flex items-center gap-3 py-3 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelect(inv.id)}
                disabled={!hasEmail || sending}
                aria-label={`Sélectionner ${inv.invoiceNumber ?? inv.id}`}
                className="h-4 w-4 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/facturation/${inv.id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {inv.invoiceNumber ?? "Brouillon"}
                  </Link>
                  <Badge
                    variant="destructive"
                    className="text-[10px] shrink-0"
                  >
                    J+{daysLate}
                  </Badge>
                  {!hasEmail && (
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 gap-1 text-amber-600 border-amber-300"
                    >
                      <MailX className="h-2.5 w-2.5" />
                      Pas d&apos;email
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {inv.tenantName}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--color-status-negative)] tabular-nums">
                    {fmt(remaining)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Éch.{" "}
                    {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => void handleSingleSend(inv)}
                  disabled={isSending || !hasEmail}
                  title={
                    hasEmail
                      ? `Relancer ${inv.tenantName}`
                      : "Impossible : pas d'email"
                  }
                >
                  {isSending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Bell className="h-3 w-3" />
                  )}
                  Relancer
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredInvoices.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucune facture en retard ne correspond à cette recherche.
        </p>
      )}

      {filteredInvoices.length > 1 && !someSelected && (
        <p className="text-xs text-muted-foreground text-center pt-1 flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Cochez plusieurs factures pour les relancer en masse
        </p>
      )}
    </div>
  );
}
