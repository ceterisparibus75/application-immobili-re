"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const LEVEL_LABELS: Record<string, string> = {
  RELANCE_1: "1ère relance",
  RELANCE_2: "2ème relance",
  MISE_EN_DEMEURE: "Mise en demeure",
  CONTENTIEUX: "Contentieux",
};

const LEVEL_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RELANCE_1: "secondary",
  RELANCE_2: "outline",
  MISE_EN_DEMEURE: "destructive",
  CONTENTIEUX: "destructive",
};

const LEVEL_ORDER: Record<string, number> = {
  RELANCE_1: 1,
  RELANCE_2: 2,
  MISE_EN_DEMEURE: 3,
  CONTENTIEUX: 4,
};

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

interface ReminderItem {
  id: string;
  level: string;
  subject: string;
  totalAmount: number;
  sentAt: string | null;
  createdAt: string;
  isSent: boolean;
  emailStatus: string | null;
  channel: string | null;
}

interface TenantGroup {
  tenantId: string;
  tenantName: string;
  lotLabel: string;
  totalReminders: number;
  lastReminderDate: string | null;
  lastLevel: string;
  reminders: ReminderItem[];
}

export function RelancesHistory({
  historyByTenant,
}: {
  historyByTenant: TenantGroup[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  function toggleExpand(tenantId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  }

  const filtered = search
    ? historyByTenant.filter(
        (g) =>
          g.tenantName.toLowerCase().includes(search.toLowerCase()) ||
          g.lotLabel.toLowerCase().includes(search.toLowerCase())
      )
    : historyByTenant;

  if (historyByTenant.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm font-medium">Aucune relance enregistrée</p>
        <p className="text-xs text-muted-foreground mt-1">
          L&apos;historique des relances apparaîtra ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Recherche */}
      {historyByTenant.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un locataire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      )}

      {/* Liste par locataire */}
      <div className="divide-y">
        {filtered.map((group) => {
          const isExpanded = expandedIds.has(group.tenantId);
          const maxLevel = Math.max(
            ...group.reminders.map((r) => LEVEL_ORDER[r.level] ?? 0)
          );
          const maxLevelKey = Object.entries(LEVEL_ORDER).find(
            ([, v]) => v === maxLevel
          )?.[0];

          return (
            <div key={group.tenantId}>
              {/* En-tête du locataire */}
              <button
                type="button"
                className="flex items-center gap-3 w-full py-3 text-left hover:bg-muted/30 transition-colors rounded -mx-1 px-1"
                onClick={() => toggleExpand(group.tenantId)}
              >
                <div className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {group.tenantName}
                    </span>
                    {maxLevelKey && (
                      <Badge
                        variant={LEVEL_VARIANTS[maxLevelKey] ?? "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {LEVEL_LABELS[maxLevelKey]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {group.lotLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {group.totalReminders} relance
                    {group.totalReminders > 1 ? "s" : ""}
                  </Badge>
                  {group.lastReminderDate && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Dernière :{" "}
                      {new Date(group.lastReminderDate).toLocaleDateString(
                        "fr-FR"
                      )}
                    </p>
                  )}
                </div>
              </button>

              {/* Détail des relances */}
              {isExpanded && (
                <div className="pl-8 pb-3 space-y-1.5">
                  {group.reminders.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 text-sm py-1.5 px-2 rounded bg-muted/20"
                    >
                      {/* Statut envoi */}
                      <div className="shrink-0">
                        {r.isSent ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-status-positive)]" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-[var(--color-status-negative)]" />
                        )}
                      </div>

                      {/* Niveau */}
                      <Badge
                        variant={LEVEL_VARIANTS[r.level] ?? "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {LEVEL_LABELS[r.level] ?? r.level}
                      </Badge>

                      {/* Sujet */}
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {r.subject}
                      </span>

                      {/* Montant */}
                      <span className="text-xs font-semibold tabular-nums shrink-0">
                        {fmt(r.totalAmount)}
                      </span>

                      {/* Canal */}
                      <div className="shrink-0">
                        {r.channel === "email" ? (
                          <Mail className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Mail className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>

                      {/* Date */}
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-20 text-right">
                        {r.sentAt
                          ? new Date(r.sentAt).toLocaleDateString("fr-FR")
                          : new Date(r.createdAt).toLocaleDateString(
                              "fr-FR"
                            )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun locataire trouvé pour « {search} »
        </p>
      )}
    </div>
  );
}
