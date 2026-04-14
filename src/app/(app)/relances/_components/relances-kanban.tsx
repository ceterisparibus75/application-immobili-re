"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

// ─── Types (miroir du overdueData du serveur) ─────────────────────────────────

type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  totalTTC: number;
  dueDate: string;
  status: string;
  paid: number;
  tenantName: string;
  tenantEmail: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLUMNS: { key: string; label: string; min: number; max: number; color: string; bg: string }[] = [
  { key: "0-30", label: "0 – 30 jours", min: 0, max: 30, color: "var(--color-status-caution)", bg: "var(--color-status-caution-bg)" },
  { key: "31-60", label: "31 – 60 jours", min: 31, max: 60, color: "#d97706", bg: "#fef3c7" },
  { key: "61-90", label: "61 – 90 jours", min: 61, max: 90, color: "#dc4e14", bg: "#fff0ea" },
  { key: "90+", label: "90 jours +", min: 91, max: Infinity, color: "var(--color-status-negative)", bg: "var(--color-status-negative-bg)" },
];

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function daysOverdue(dueDateStr: string): number {
  return Math.floor((Date.now() - new Date(dueDateStr).getTime()) / 86400000);
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function RelancesKanban({ overdueInvoices }: { overdueInvoices: OverdueInvoice[] }) {
  const columns = COLUMNS.map((col) => ({
    ...col,
    invoices: overdueInvoices.filter((inv) => {
      const days = daysOverdue(inv.dueDate);
      return days >= col.min && days <= col.max;
    }),
  }));

  const total = overdueInvoices.reduce((s, inv) => s + (inv.totalTTC - inv.paid), 0);

  return (
    <div className="space-y-3">
      {/* Récap total */}
      {total > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-[var(--color-status-negative)]" />
          <span>
            <span className="font-semibold text-[var(--color-status-negative)]">{fmt(total)}</span>{" "}
            au total sur {overdueInvoices.length} facture{overdueInvoices.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Colonnes Kanban */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => (
          <div key={col.key} className="rounded-xl border bg-white overflow-hidden">
            {/* En-tête colonne */}
            <div
              className="px-3 py-2.5 flex items-center justify-between"
              style={{ background: col.bg }}
            >
              <span className="text-xs font-semibold" style={{ color: col.color }}>
                {col.label}
              </span>
              <span
                className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: col.color, color: "#fff" }}
              >
                {col.invoices.length}
              </span>
            </div>

            {/* Cartes */}
            <div className="divide-y">
              {col.invoices.length === 0 ? (
                <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                  Aucune facture
                </p>
              ) : (
                col.invoices.map((inv) => {
                  const remaining = inv.totalTTC - inv.paid;
                  const days = daysOverdue(inv.dueDate);
                  return (
                    <Link
                      key={inv.id}
                      href={`/facturation/${inv.id}`}
                      className="block px-3 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{inv.tenantName}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0 font-semibold"
                          style={{ color: col.color, borderColor: col.color }}
                        >
                          J+{days}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-1.5">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-sm font-semibold tabular-nums" style={{ color: col.color }}>
                        {fmt(remaining)}
                      </p>
                      {inv.paid > 0 && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Payé : {fmt(inv.paid)} / {fmt(inv.totalTTC)}
                        </p>
                      )}
                    </Link>
                  );
                })
              )}
            </div>

            {/* Total colonne */}
            {col.invoices.length > 0 && (
              <div
                className="px-3 py-2 border-t"
                style={{ background: col.bg }}
              >
                <p className="text-xs font-semibold tabular-nums" style={{ color: col.color }}>
                  Total :{" "}
                  {fmt(col.invoices.reduce((s, inv) => s + (inv.totalTTC - inv.paid), 0))}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
