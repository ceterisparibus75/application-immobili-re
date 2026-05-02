"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ALL_CATEGORIES } from "@/lib/cashflow-categories";
import { X } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "", label: "Toutes catégories" },
  ...ALL_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

const DIRECTION_OPTIONS = [
  { value: "", label: "Entrées et sorties" },
  { value: "credit", label: "Entrées uniquement" },
  { value: "debit", label: "Sorties uniquement" },
];

const PERIOD_OPTIONS = [
  { value: "last30", label: "30 derniers jours" },
  { value: "month", label: "Mois choisi" },
  { value: "custom", label: "Dates personnalisées" },
];

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const updatePeriod = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("dateFrom");
      params.delete("dateTo");
      if (value === "last30") {
        params.delete("period");
        params.delete("month");
      } else {
        params.set("period", value);
        if (value === "month" && !params.get("month")) params.set("month", getCurrentMonthValue());
        if (value !== "month") params.delete("month");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const updateMonth = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("dateFrom");
      params.delete("dateTo");
      if (value) {
        params.set("period", "month");
        params.set("month", value);
      } else {
        params.delete("period");
        params.delete("month");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const updateDate = useCallback(
    (key: "dateFrom" | "dateTo", value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("month");
      if (value) {
        params.set("period", "custom");
        params.set(key, value);
      } else {
        params.delete(key);
        if (!params.has("dateFrom") && !params.has("dateTo")) params.delete("period");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const reset = () => router.push(pathname);
  const period = searchParams.get("period") ?? "last30";

  const hasFilters =
    searchParams.has("dateFrom") ||
    searchParams.has("dateTo") ||
    searchParams.has("month") ||
    searchParams.has("category") ||
    searchParams.has("direction") ||
    searchParams.has("period");

  return (
    <div className="flex flex-wrap gap-3 items-end px-4 pb-3 border-b border-border/50">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Période</Label>
        <NativeSelect
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(e) => updatePeriod(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      {period === "month" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mois</Label>
          <Input
            type="month"
            className="h-8 text-xs w-36"
            value={searchParams.get("month") ?? getCurrentMonthValue()}
            onChange={(e) => updateMonth(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Du</Label>
        <Input
          type="date"
          className="h-8 text-xs w-36"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateDate("dateFrom", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Au</Label>
        <Input
          type="date"
          className="h-8 text-xs w-36"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateDate("dateTo", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Catégorie</Label>
        <NativeSelect
          options={CATEGORY_OPTIONS}
          value={searchParams.get("category") ?? ""}
          onChange={(e) => update("category", e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Direction</Label>
        <NativeSelect
          options={DIRECTION_OPTIONS}
          value={searchParams.get("direction") ?? ""}
          onChange={(e) => update("direction", e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 gap-1 text-xs">
          <X className="h-3 w-3" />
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
