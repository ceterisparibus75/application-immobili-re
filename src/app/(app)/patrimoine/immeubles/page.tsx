import { getBuildings } from "@/actions/building";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, ChevronRight, Plus, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BuildingType } from "@/generated/prisma/client";

export const metadata = { title: "Immeubles" };

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  BUREAU: "Bureau", COMMERCE: "Commerce", MIXTE: "Mixte", ENTREPOT: "Entrepot",
};

const FREQ_MULT: Record<string, number> = { MENSUEL: 12, TRIMESTRIEL: 4, SEMESTRIEL: 2, ANNUEL: 1 };

export default async function ImmeublesPage() {
  const headersList = await headers();
  const societyId = headersList.get("x-society-id");
  if (!societyId) redirect("/societes");

  const buildings = await getBuildings(societyId);

  // KPIs globaux
  const totalLots = buildings.reduce((s, b) => s + b.lots.length, 0);
  const occupiedLots = buildings.reduce((s, b) => s + b.lots.filter((l) => l.status === "OCCUPE").length, 0);
  const globalOccupancy = totalLots > 0 ? Math.round((occupiedLots / totalLots) * 100) : 0;
  const totalAnnualRent = buildings.reduce((s, b) => {
    return s + b.lots.reduce((ls, lot) => {
      const lease = lot.leases[0];
      if (!lease) return ls;
      return ls + lease.currentRentHT * (FREQ_MULT[lease.paymentFrequency] ?? 12);
    }, 0);
  }, 0);
  const totalCostAll = buildings.reduce((s, b) => s + (b.totalCost ?? 0), 0);
  const totalVenalValue = buildings.reduce((s, b) => s + (b.propertyValuations?.[0]?.estimatedValueMid ?? 0), 0);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Immeubles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {buildings.length} immeuble{buildings.length !== 1 ? "s" : ""} — {totalLots} lots — Occupation {globalOccupancy}%
          </p>
        </div>
        <Link href="/patrimoine/immeubles/nouveau">
          <Button><Plus className="h-4 w-4" />Nouvel immeuble</Button>
        </Link>
      </div>

      {/* KPIs synthèse */}
      {buildings.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Immeubles</p>
            <p className="text-2xl font-bold tabular-nums">{buildings.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Occupation</p>
            <p className="text-2xl font-bold tabular-nums">{occupiedLots}/{totalLots} <span className="text-base font-medium text-muted-foreground">({globalOccupancy}%)</span></p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Revenus annuels HT</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalAnnualRent)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Coût complet patrimoine</p>
            <p className="text-2xl font-bold tabular-nums">{totalCostAll > 0 ? formatCurrency(totalCostAll) : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Valeur vénale totale</p>
            <p className="text-2xl font-bold tabular-nums">{totalVenalValue > 0 ? formatCurrency(totalVenalValue) : "—"}</p>
          </div>
        </div>
      )}

      {buildings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-5">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Aucun immeuble</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Ajoutez votre premier immeuble pour commencer à gérer vos lots et baux locatifs.
            </p>
            <Link href="/patrimoine/immeubles/nouveau">
              <Button><Plus className="h-4 w-4" />Ajouter un immeuble</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-brand bg-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {/* Header tableau */}
            <div className="hidden md:grid md:grid-cols-[1fr_80px_75px_120px_120px_120px_90px_80px_28px] gap-2 px-5 py-3 border-b bg-muted/30">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Immeuble</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Surface</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Occup.</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Loyers/an</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Coût complet</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Val. vénale</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Variation</span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Rendt.</span>
              <span />
            </div>

            {buildings.map((building, index) => {
              const occupied = building.lots.filter((l) => l.status === "OCCUPE").length;
              const total = building.lots.length;
              const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              const annualRent = building.annualRent;
              const cost = building.totalCost;
              const venalValue = building.propertyValuations?.[0]?.estimatedValueMid ?? null;
              const variation = (cost > 0 && venalValue) ? Math.round(((venalValue - cost) / cost) * 1000) / 10 : null;
              const rendement = building.yieldRate !== null ? Math.round(building.yieldRate * 10) / 10 : null;
              const totalArea = building.totalArea ?? building.lots.reduce((s, l) => s + (l.area ?? 0), 0);

              // Alerte : baux expirant dans < 90j
              const cutoff90d = new Date();
              cutoff90d.setDate(cutoff90d.getDate() + 90);
              const expiringLeases = building.lots
                .filter((lot) => {
                  const lease = lot.leases[0];
                  return lease && lease.endDate && new Date(lease.endDate) <= cutoff90d;
                })
                .map((lot) => ({
                  lotName: `Lot ${lot.number}`,
                  endDate: lot.leases[0]?.endDate ? new Date(lot.leases[0].endDate) : null,
                }));
              const expiringSoon = expiringLeases.length > 0;

              return (
                <Link
                  key={building.id}
                  href={`/patrimoine/immeubles/${building.id}`}
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
                          <span className="text-sm font-semibold truncate">{building.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{BUILDING_TYPE_LABELS[building.buildingType]}</Badge>
                          {expiringSoon && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="shrink-0 cursor-help">
                                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="font-semibold text-xs mb-1">Baux expirant sous 90 jours</p>
                                <ul className="text-xs space-y-0.5">
                                  {expiringLeases.map((el, i) => (
                                    <li key={i}>
                                      {el.lotName} — fin le {el.endDate ? formatDate(el.endDate) : "—"}
                                    </li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                          {building.city} — {total} lot{total !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm tabular-nums text-right text-muted-foreground">
                      {totalArea > 0 ? `${totalArea.toLocaleString("fr-FR")} m²` : "—"}
                    </span>
                    <div className="flex justify-center">
                      <OccupancyBadge occupied={occupied} total={total} pct={occupancyPct} />
                    </div>
                    <span className="text-sm font-medium tabular-nums text-right">
                      {annualRent > 0 ? formatCurrency(annualRent) : <span className="text-muted-foreground font-normal">—</span>}
                    </span>
                    <span className="text-sm tabular-nums text-right">
                      {cost > 0 ? formatCurrency(cost) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className="text-sm tabular-nums text-right">
                      {venalValue ? formatCurrency(venalValue) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <div className="flex justify-center">
                      {variation !== null ? (
                        <span className={`text-sm font-semibold tabular-nums ${variation >= 0 ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-negative)]"}`}>
                          {variation >= 0 ? "+" : ""}{variation.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {rendement !== null ? (
                        <span className={`text-sm font-semibold tabular-nums ${rendement >= 5 ? "text-[var(--color-status-positive)]" : rendement >= 3 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-negative)]"}`}>
                          {rendement}%
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{building.name}</span>
                          {expiringSoon && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="shrink-0 cursor-help">
                                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-caution)]" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="font-semibold text-xs mb-1">Baux expirant sous 90 jours</p>
                                <ul className="text-xs space-y-0.5">
                                  {expiringLeases.map((el, i) => (
                                    <li key={i}>
                                      {el.lotName} — fin le {el.endDate ? formatDate(el.endDate) : "—"}
                                    </li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{building.city}</span>
                          <span>{occupied}/{total} lots</span>
                          {totalArea > 0 && <span>{totalArea} m²</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <div className="text-right">
                        {annualRent > 0 && (
                          <p className="text-xs font-semibold tabular-nums">{formatCurrency(annualRent)}/an</p>
                        )}
                        {rendement !== null && (
                          <p className={`text-[11px] font-medium tabular-nums ${rendement >= 5 ? "text-[var(--color-status-positive)]" : rendement >= 3 ? "text-[var(--color-status-caution)]" : "text-[var(--color-status-negative)]"}`}>
                            <TrendingUp className="h-3 w-3 inline mr-0.5" />{rendement}%
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
    </TooltipProvider>
  );
}

function OccupancyBadge({ occupied, total, pct }: { occupied: number; total: number; pct: number }) {
  const variant = pct === 100 ? "success" : pct >= 70 ? "warning" : "destructive";
  const variantClasses: Record<string, string> = {
    success: "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)] border-[var(--color-status-positive)]/20",
    warning: "bg-[var(--color-status-caution-bg)] text-[var(--color-status-caution)] border-[var(--color-status-caution)]/20",
    destructive: "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)] border-[var(--color-status-negative)]/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${variantClasses[variant]}`}>
      {occupied}/{total}
    </span>
  );
}
