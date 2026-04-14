"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  LayoutGrid,
  List,
  MapPin,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Types ──────────────────────────────────────────────────────── */

export type LeaseSummary = {
  id: string;
  tenantName: string;
  lotNumbers: string;
  destination: string | null;
  buildingName: string;
  buildingCity: string;
  currentRentHT: number;
  paymentFrequency: string;
  startDate: string;
  endDate: string;
  status: string;
  statusLabel: string;
  statusVariant: "success" | "secondary" | "warning" | "destructive" | "default";
  leaseTypeLabel: string;
  isThirdPartyManaged: boolean;
  indexationStatus: "done" | "pending" | "none";
};

export type BuildingGroupSummary = {
  buildingId: string;
  buildingName: string;
  buildingCity: string;
  leases: LeaseSummary[];
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatCurrency(n: number) {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const FREQ_LABELS: Record<string, string> = {
  MENSUEL: "mois",
  TRIMESTRIEL: "trim.",
  SEMESTRIEL: "sem.",
  ANNUEL: "an",
};

function progressPercent(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function daysUntil(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

/* ─── Card individuelle ───────────────────────────────────────────── */

function LeaseCard({ lease }: { lease: LeaseSummary }) {
  const pct = progressPercent(lease.startDate, lease.endDate);
  const remaining = daysUntil(lease.endDate);
  const isExpiringSoon = remaining >= 0 && remaining <= 90;
  const isExpired = remaining < 0;

  return (
    <Link href={`/baux/${lease.id}`} className="block group">
      <div className="bg-white rounded-xl shadow-brand hover:shadow-brand-lg transition-shadow p-4 h-full flex flex-col gap-3">
        {/* Header : locataire + statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm text-[var(--color-brand-deep)] truncate">
                {lease.tenantName}
              </p>
              {lease.isThirdPartyManaged && (
                <Badge
                  variant="outline"
                  className="text-teal-700 border-teal-300 bg-teal-50 text-[10px] px-1.5 py-0 shrink-0"
                >
                  Tiers
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {lease.lotNumbers}
              {lease.destination && (
                <> · <span className="text-muted-foreground/70">{lease.destination}</span></>
              )}
            </p>
          </div>
          <Badge variant={lease.statusVariant} className="text-[11px] shrink-0">
            {lease.statusLabel}
          </Badge>
        </div>

        {/* Immeuble */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lease.buildingName}</span>
          <MapPin className="h-3 w-3 shrink-0 ml-0.5" />
          <span className="truncate">{lease.buildingCity}</span>
        </div>

        {/* Loyer + type */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold tabular-nums text-[var(--color-brand-deep)]">
              {formatCurrency(lease.currentRentHT)} €
            </p>
            <p className="text-[10px] text-muted-foreground">
              HT/{FREQ_LABELS[lease.paymentFrequency] ?? lease.paymentFrequency}
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] font-normal">
            {lease.leaseTypeLabel}
          </Badge>
        </div>

        {/* Timeline de progression */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{new Date(lease.startDate).toLocaleDateString("fr-FR")}</span>
            <span
              className={
                isExpired
                  ? "text-[var(--color-status-negative)] font-semibold"
                  : isExpiringSoon
                    ? "text-[var(--color-status-caution)] font-semibold"
                    : ""
              }
            >
              {isExpired
                ? "Expiré"
                : isExpiringSoon
                  ? `${remaining}j restants`
                  : new Date(lease.endDate).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-gradient-soft transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Footer : indexation */}
        <div className="flex items-center justify-between text-xs border-t border-gray-50 pt-2 mt-auto">
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            Indexation
          </span>
          {lease.indexationStatus === "none" ? (
            <Minus className="h-3.5 w-3.5 text-muted-foreground/30" />
          ) : lease.indexationStatus === "done" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              À jour
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              À faire
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Composant principal ─────────────────────────────────────────── */

export function BauxViewToggle({
  actifsGrouped,
  autresGrouped,
  totalMensuel,
}: {
  actifsGrouped: BuildingGroupSummary[];
  autresGrouped: BuildingGroupSummary[];
  totalMensuel: number;
}) {
  const [view, setView] = useState<"table" | "cards">("table");

  const allActifs = actifsGrouped.flatMap((g) => g.leases);
  const allAutres = autresGrouped.flatMap((g) => g.leases);

  return (
    <div className="space-y-6">
      {/* Toggle vue */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allActifs.length} bail{allActifs.length > 1 ? "s" : ""} actif
          {allActifs.length > 1 ? "s" : ""}
          {allActifs.length > 0 && (
            <span className="ml-1.5">
              · {formatCurrency(totalMensuel)} €&nbsp;HT/mois
            </span>
          )}
        </p>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("table")}
            className={`h-7 px-2.5 rounded-md text-xs gap-1.5 ${
              view === "table"
                ? "bg-white shadow-sm text-[var(--color-brand-deep)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Tableau
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("cards")}
            className={`h-7 px-2.5 rounded-md text-xs gap-1.5 ${
              view === "cards"
                ? "bg-white shadow-sm text-[var(--color-brand-deep)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </Button>
        </div>
      </div>

      {/* Vue tableau — rendu by building group via slot */}
      {view === "table" && (
        <div id="baux-table-view">
          {actifsGrouped.map((group) => (
            <BauxTableGroup key={group.buildingId} group={group} dimmed={false} />
          ))}
          {allActifs.length > 1 && actifsGrouped.length > 1 && (
            <div className="flex justify-end px-1">
              <p className="text-sm text-muted-foreground">
                Total mensuel HT :{" "}
                <span className="font-semibold tabular-nums text-[var(--color-brand-deep)]">
                  {formatCurrency(totalMensuel)} €
                </span>
              </p>
            </div>
          )}
          {allAutres.length > 0 && (
            <>
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  Baux terminés / autres
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {autresGrouped.map((group) => (
                <BauxTableGroup key={group.buildingId} group={group} dimmed />
              ))}
            </>
          )}
        </div>
      )}

      {/* Vue cards */}
      {view === "cards" && (
        <div id="baux-cards-view" className="space-y-6">
          {actifsGrouped.map((group) => (
            <div key={group.buildingId} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{group.buildingName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {group.buildingCity}
                    <span className="text-muted-foreground/50 mx-1">·</span>
                    {group.leases.length} bail{group.leases.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.leases.map((lease) => (
                  <LeaseCard key={lease.id} lease={lease} />
                ))}
              </div>
            </div>
          ))}

          {allAutres.length > 0 && (
            <>
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  Baux terminés / autres
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                {allAutres.map((lease) => (
                  <LeaseCard key={lease.id} lease={lease} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Groupe tableau (réutilise le rendu existant) ───────────────── */

function BauxTableGroup({
  group,
  dimmed,
}: {
  group: BuildingGroupSummary;
  dimmed: boolean;
}) {
  return (
    <Card className={dimmed ? "opacity-60" : ""}>
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {group.buildingName}
            </CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {group.buildingCity}
              <span className="text-muted-foreground/50 mx-1">·</span>
              {group.leases.length} bail{group.leases.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="border-y bg-muted/30">
                <th className="text-left py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Locataire / Lot
                </th>
                <th className="text-right py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Loyer HT
                </th>
                <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">
                  Échéance
                </th>
                <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">
                  Type
                </th>
                <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-center py-2 px-5 font-medium text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">
                  Indexation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {group.leases.map((lease) => (
                <tr
                  key={lease.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-5">
                    <Link href={`/baux/${lease.id}`} className="block">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium truncate">{lease.tenantName}</p>
                        {lease.isThirdPartyManaged && (
                          <Badge
                            variant="outline"
                            className="text-teal-700 border-teal-300 bg-teal-50 text-[10px] px-1.5 py-0 shrink-0"
                          >
                            Tiers
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {lease.lotNumbers}
                        </span>
                        {lease.destination && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-xs text-muted-foreground/70">
                              {lease.destination}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <Link href={`/baux/${lease.id}`} className="block">
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(lease.currentRentHT)} €
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        HT/{FREQ_LABELS[lease.paymentFrequency] ?? lease.paymentFrequency}
                      </p>
                    </Link>
                  </td>
                  <td className="py-3 px-5 text-center hidden sm:table-cell">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(lease.endDate).toLocaleDateString("fr-FR")}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-center hidden md:table-cell">
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {lease.leaseTypeLabel}
                    </Badge>
                  </td>
                  <td className="py-3 px-5 text-center">
                    <Badge
                      variant={lease.statusVariant}
                      className="text-[11px]"
                    >
                      {lease.statusLabel}
                    </Badge>
                  </td>
                  <td className="py-3 px-5 text-center hidden lg:table-cell">
                    {lease.indexationStatus === "none" ? (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
                    ) : lease.indexationStatus === "done" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        À jour
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />À faire
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
