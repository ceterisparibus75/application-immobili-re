"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CashflowDashboard } from "@/actions/cashflow";

export function MonthlyDetail({ data }: { data: CashflowDashboard }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pastMonths = data.months.filter((m) => m.isPast && (m.actualExpenses > 0 || m.actualIncome > 0));

  if (pastMonths.length === 0) return null;

  return (
    <Card className="border-0 shadow-brand bg-card rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Détail mensuel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-3">
        {pastMonths.map((month) => {
          const isExpanded = expanded === month.month;
          const net = month.actualIncome - month.actualExpenses;
          return (
            <div key={month.month} className="border border-border/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : month.month)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left cursor-pointer"
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <span className="flex-1 text-sm font-semibold text-foreground">{month.label}</span>
                <span className="text-xs font-mono text-[var(--color-status-positive)] tabular-nums">
                  +{formatCurrency(month.actualIncome)}
                </span>
                <span className="text-xs font-mono text-[var(--color-status-negative)] tabular-nums">
                  -{formatCurrency(month.actualExpenses)}
                </span>
                <span className={`text-xs font-mono font-semibold tabular-nums ml-2 px-2 py-0.5 rounded-full ${
                  net >= 0
                    ? "bg-[var(--color-status-positive-bg)] text-[var(--color-status-positive)]"
                    : "bg-[var(--color-status-negative-bg)] text-[var(--color-status-negative)]"
                }`}>
                  {net >= 0 ? "+" : ""}{formatCurrency(net)}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 grid gap-4 lg:grid-cols-2">
                  {/* Dépenses du mois */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ArrowUpRight className="h-3 w-3 text-[var(--color-status-negative)]" />
                      Dépenses
                    </p>
                    {month.expenseBreakdown.length > 0 ? (
                      <div className="space-y-1.5">
                        {month.expenseBreakdown.map((b) => (
                          <div key={b.categoryId} className="flex items-center gap-2 text-sm">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <span className="flex-1 text-muted-foreground text-xs">{b.label}</span>
                            <span className="font-mono text-xs tabular-nums">{formatCurrency(b.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune dépense</p>
                    )}
                  </div>
                  {/* Revenus du mois */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ArrowDownLeft className="h-3 w-3 text-[var(--color-status-positive)]" />
                      Revenus
                    </p>
                    {month.incomeBreakdown.length > 0 ? (
                      <div className="space-y-1.5">
                        {month.incomeBreakdown.map((b) => (
                          <div key={b.categoryId} className="flex items-center gap-2 text-sm">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <span className="flex-1 text-muted-foreground text-xs">{b.label}</span>
                            <span className="font-mono text-xs tabular-nums">{formatCurrency(b.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucun revenu</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
