"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Bell, Loader2 } from "lucide-react";
import { sendBulkReminders } from "@/actions/reminder";
import SendReminderButton from "./send-reminder-button";
import { toast } from "sonner";
import type { ReminderLevel } from "@/generated/prisma/client";

const NOW = Date.now();

const LEVEL_OPTIONS: { value: ReminderLevel; label: string }[] = [
  { value: "RELANCE_1", label: "1ère relance (amiable)" },
  { value: "RELANCE_2", label: "2ème relance (formelle)" },
  { value: "MISE_EN_DEMEURE", label: "Mise en demeure" },
];

type OverdueInvoice = {
  id: string;
  invoiceNumber: string | null;
  totalTTC: number;
  dueDate: Date;
  payments: { amount: number }[];
  lease: {
    tenant: {
      entityType: string;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
};

function tenantName(lease: OverdueInvoice["lease"]): string {
  if (!lease?.tenant) return "—";
  if (lease.tenant.entityType === "PERSONNE_MORALE") return lease.tenant.companyName ?? "—";
  return `${lease.tenant.firstName ?? ""} ${lease.tenant.lastName ?? ""}`.trim() || "—";
}

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
}

export function RelancesClient({
  societyId,
  overdueInvoices,
}: {
  societyId: string;
  overdueInvoices: OverdueInvoice[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLevel, setBulkLevel] = useState<ReminderLevel>("RELANCE_1");
  const [sending, setSending] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === overdueInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(overdueInvoices.map((inv) => inv.id)));
    }
  }

  async function handleBulkSend() {
    if (selectedIds.size === 0) return;
    setSending(true);
    const result = await sendBulkReminders(societyId, Array.from(selectedIds), bulkLevel);
    setSending(false);
    if (result.success) {
      const { sent, failed } = result.data!;
      if (failed > 0) {
        toast.warning(`${sent} relance${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}, ${failed} échec${failed > 1 ? "s" : ""}`);
      } else {
        toast.success(`${sent} relance${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}`);
      }
      setSelectedIds(new Set());
    } else {
      toast.error(result.error ?? "Erreur lors de l'envoi");
    }
  }

  const allSelected = selectedIds.size === overdueInvoices.length && overdueInvoices.length > 0;
  const someSelected = selectedIds.size > 0;

  if (overdueInvoices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Aucune facture en retard</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Tout sélectionner"
            className="h-4 w-4"
          />
          <span className="text-xs text-muted-foreground">
            {someSelected
              ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}`
              : "Tout sélectionner"}
          </span>
        </div>

        {someSelected && (
          <>
            <Select value={bulkLevel} onValueChange={(v) => setBulkLevel(v as ReminderLevel)}>
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => void handleBulkSend()}
              disabled={sending}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              Envoyer {selectedIds.size} relance{selectedIds.size > 1 ? "s" : ""}
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

      {/* Invoice list */}
      <div className="divide-y">
        {overdueInvoices.map((inv) => {
          const daysLate = Math.floor((NOW - new Date(inv.dueDate).getTime()) / 86400000);
          const paid = inv.payments.reduce((ps, p) => ps + p.amount, 0);
          const remaining = inv.totalTTC - paid;
          const isSelected = selectedIds.has(inv.id);

          return (
            <div
              key={inv.id}
              className={`flex items-center gap-3 py-3 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelect(inv.id)}
                aria-label={`Sélectionner ${inv.invoiceNumber ?? inv.id}`}
                className="h-4 w-4 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/facturation/${inv.id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {inv.invoiceNumber}
                  </Link>
                  <Badge variant="destructive" className="text-xs shrink-0">
                    J+{daysLate}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{tenantName(inv.lease)}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">{fmt(remaining)}</p>
                  <p className="text-xs text-muted-foreground">
                    Éch. {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <SendReminderButton
                  societyId={societyId}
                  invoiceId={inv.id}
                  defaultLevel={
                    daysLate >= 30 ? "MISE_EN_DEMEURE" : daysLate >= 15 ? "RELANCE_2" : "RELANCE_1"
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {overdueInvoices.length > 1 && !someSelected && (
        <p className="text-xs text-muted-foreground text-center pt-1 flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Cochez plusieurs factures pour les relancer en masse
        </p>
      )}
    </div>
  );
}
