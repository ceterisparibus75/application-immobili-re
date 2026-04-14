"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Building2, ChevronRight, LayoutGrid, LayoutList, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuildingSummary = {
  id: string;
  name: string;
  city: string;
  buildingType: string;
  totalArea: number;
  occupiedLots: number;
  totalLots: number;
  occupancyPct: number;
  annualRent: number;
  cost: number;
  venalValue: number | null;
  variation: number | null;
  rendement: number | null;
  expiringSoon: boolean;
  expiringLeases: { lotName: string; endDate: string | null }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUILDING_TYPE_LABELS: Record<string, string> = {
  BUREAU: "Bureau",
  COMMERCE: "Commerce",
  MIXTE: "Mixte",
  ENTREPOT: "Entrepôt",
  RESIDENTIEL: "Résidentiel",
};

function OccupancyBadge({
  occupied,
  total,
  pct,
}: {
  occupied: number;
  total: number;
  pct: number;
}) {
  const cls =
    pct === 100
      ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border-[var(--color-status-positive)]/20"
      : pct >= 70
        ? "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] border-[var(--color-status-caution)]/20"
        : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)] border-[var(--color-status-negative)]/20";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${cls}`}
    >
      {occupied}/{total}
    </span>
  );
}

// ─── Vue Tableau ──────────────────────────────────────────────────────────────

function TableView({ buildings }: { buildings: BuildingSummary[] }) {
  return (
    <div className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid md:grid-cols-[1fr_80px_75px_120px_120px_120px_90px_80px_28px] gap-2 px-5 py-3 border-b bg-muted/30">
        {[
          "Immeuble",
          "Surface",
          "Occup.",
          "Loyers/an",
          "Coût complet",
          "Val. vénale",
          "Variation",
          "Rendt.",
          "",
        ].map((h, i) => (
          <span
            key={i}
            className={`text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${i >= 3 ? "text-right" : i === 2 || i === 6 || i === 7 ? "text-center" : ""}`}
          >
            {h}
          </span>
        ))}
      </div>

      {buildings.map((b, index) => (
        <Link
          key={b.id}
          href={`/patrimoine/immeubles/${b.id}`}
          className={`block transition-colors hover:bg-accent/50 group ${index < buildings.length - 1 ? "border-b" : ""}`}
        >
          {/* Desktop */}
          <div className="hidden md:grid md:grid-cols-[1fr_80px_75px_120px_120px_120px_90px_80px_28px] gap-2 items-center px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{b.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {BUILDING_TYPE_LABELS[b.buildingType] ?? b.buildingType}
                  </Badge>
                  {b.expiringSoon && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0 cursor-help">
                          <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-semibold text-xs mb-1">
                          Baux expirant sous 90 jours
                        </p>
                        <ul className="text-xs space-y-0.5">
                          {b.expiringLeases.map((el, i) => (
                            <li key={i}>
                              {el.lotName} — fin le {el.endDate ?? "—"}
                            </li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate block">
                  {b.city} — {b.totalLots} lot{b.totalLots !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <span className="text-sm tabular-nums text-right text-muted-foreground">
              {b.totalArea > 0 ? `${b.totalArea.toLocaleString("fr-FR")} m²` : "—"}
            </span>
            <div className="flex justify-center">
              <OccupancyBadge
                occupied={b.occupiedLots}
                total={b.totalLots}
                pct={b.occupancyPct}
              />
            </div>
            <span className="text-sm font-medium tabular-nums text-right">
              {b.annualRent > 0 ? (
                formatCurrency(b.annualRent)
              ) : (
                <span className="text-muted-foreground font-normal">—</span>
              )}
            </span>
            <span className="text-sm tabular-nums text-right">
              {b.cost > 0 ? (
                formatCurrency(b.cost)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
            <span className="text-sm tabular-nums text-right">
              {b.venalValue ? (
                formatCurrency(b.venalValue)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
            <div className="flex justify-center">
              {b.variation !== null ? (
                <span
                  className={`text-sm font-semibold tabular-nums ${b.variation >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}
                >
                  {b.variation >= 0 ? "+" : ""}
                  {b.variation.toFixed(1)}%
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex justify-center">
              {b.rendement !== null ? (
                <span
                  className={`text-sm font-semibold tabular-nums ${b.rendement >= 5 ? "text-[var(--color-status-positive)]" : b.rendement >= 3 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-negative)]"}`}
                >
                  {b.rendement}%
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>

          {/* Mobile */}
          <div className="flex items-center justify-between px-4 py-3.5 md:hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold truncate">{b.name}</span>
                  {b.expiringSoon && (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-status-caution)]" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span>{b.city}</span>
                  <span>
                    {b.occupiedLots}/{b.totalLots} lots
                  </span>
                  {b.totalArea > 0 && <span>{b.totalArea} m²</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <div className="text-right">
                {b.annualRent > 0 && (
                  <p className="text-xs font-semibold tabular-nums">
                    {formatCurrency(b.annualRent)}/an
                  </p>
                )}
                {b.rendement !== null && (
                  <p
                    className={`text-[11px] font-medium tabular-nums ${b.rendement >= 5 ? "text-[var(--color-status-positive)]" : b.rendement >= 3 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-negative)]"}`}
                  >
                    <TrendingUp className="h-3 w-3 inline mr-0.5" />
                    {b.rendement}%
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Vue Cartes ───────────────────────────────────────────────────────────────

function CardView({ buildings }: { buildings: BuildingSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {buildings.map((b) => {
        const occupancyColor =
          b.occupancyPct === 100
            ? "var(--color-status-positive)"
            : b.occupancyPct >= 70
              ? "var(--color-status-caution)"
              : "var(--color-status-negative)";

        return (
          <Link
            key={b.id}
            href={`/patrimoine/immeubles/${b.id}`}
            className="group block rounded-xl bg-white shadow-brand hover:shadow-md transition-shadow"
          >
            {/* Card header */}
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 group-hover:from-primary/20 transition-colors">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold truncate">{b.name}</p>
                    {b.expiringSoon && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-status-caution)]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-muted-foreground">{b.city}</p>
                    <span className="text-muted-foreground/30">·</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {BUILDING_TYPE_LABELS[b.buildingType] ?? b.buildingType}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Occupation */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Occupation</span>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: occupancyColor }}
                >
                  {b.occupiedLots}/{b.totalLots} lots · {b.occupancyPct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${b.occupancyPct}%`,
                    background: occupancyColor,
                  }}
                />
              </div>
            </div>

            {/* Métriques */}
            <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
              <div className="bg-white px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">Loyers/an</p>
                <p className="text-sm font-semibold tabular-nums">
                  {b.annualRent > 0 ? formatCurrency(b.annualRent) : "—"}
                </p>
              </div>
              <div className="bg-white px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">Rendement</p>
                <p
                  className="text-sm font-semibold tabular-nums"
                  style={{
                    color:
                      b.rendement !== null
                        ? b.rendement >= 5
                          ? "var(--color-status-positive)"
                          : b.rendement >= 3
                            ? "var(--color-status-caution)"
                            : "var(--color-status-negative)"
                        : undefined,
                  }}
                >
                  {b.rendement !== null ? `${b.rendement}%` : "—"}
                </p>
              </div>
              {b.venalValue !== null && (
                <div className="bg-white px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Val. vénale</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(b.venalValue)}
                  </p>
                </div>
              )}
              {b.variation !== null && (
                <div className="bg-white px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Variation</p>
                  <p
                    className="text-sm font-semibold tabular-nums"
                    style={{
                      color:
                        b.variation >= 0
                          ? "var(--color-status-positive)"
                          : "var(--color-status-negative)",
                    }}
                  >
                    {b.variation >= 0 ? "+" : ""}
                    {b.variation.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {/* Surface */}
            {b.totalArea > 0 && (
              <div className="px-4 py-2 border-t border-gray-50">
                <p className="text-xs text-muted-foreground">
                  {b.totalArea.toLocaleString("fr-FR")} m²{" "}
                  {b.expiringSoon && (
                    <span className="text-[var(--color-status-caution)] font-medium">
                      · Baux expirant bientôt
                    </span>
                  )}
                </p>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Toggle principal ─────────────────────────────────────────────────────────

export function BuildingsViewToggle({
  buildings,
}: {
  buildings: BuildingSummary[];
}) {
  const [view, setView] = useState<"table" | "cards">("table");

  if (buildings.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Barre toggle */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setView("table")}
                  aria-label="Vue tableau"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vue tableau</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={view === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setView("cards")}
                  aria-label="Vue cartes"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vue cartes</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {view === "table" ? (
          <TableView buildings={buildings} />
        ) : (
          <CardView buildings={buildings} />
        )}
      </div>
    </TooltipProvider>
  );
}
