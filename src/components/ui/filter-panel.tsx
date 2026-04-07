"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Filter, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface FilterDefinition {
  key: string;
  label: string;
  type: "select" | "multi-select" | "date-range" | "amount-range";
  options?: { value: string; label: string; group?: string }[];
  placeholder?: string;
}

export interface FilterPanelProps {
  filters: FilterDefinition[];
  className?: string;
}

function getParamKey(key: string): string {
  return `filter_${key}`;
}

function countActiveFilters(
  filters: FilterDefinition[],
  searchParams: URLSearchParams
): number {
  let count = 0;
  for (const filter of filters) {
    switch (filter.type) {
      case "select":
      case "multi-select":
        if (searchParams.get(getParamKey(filter.key))) count++;
        break;
      case "date-range":
        if (
          searchParams.get(`${getParamKey(filter.key)}_from`) ||
          searchParams.get(`${getParamKey(filter.key)}_to`)
        )
          count++;
        break;
      case "amount-range":
        if (
          searchParams.get(`${getParamKey(filter.key)}_min`) ||
          searchParams.get(`${getParamKey(filter.key)}_max`)
        )
          count++;
        break;
    }
  }
  return count;
}

function SelectFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  const grouped = React.useMemo(() => {
    if (!filter.options) return null;
    const groups = new Map<string, { value: string; label: string }[]>();
    let hasGroups = false;
    for (const opt of filter.options) {
      const group = opt.group ?? "";
      if (opt.group) hasGroups = true;
      const list = groups.get(group) ?? [];
      list.push(opt);
      groups.set(group, list);
    }
    return hasGroups ? groups : null;
  }, [filter.options]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={filter.key}>{filter.label}</Label>
      <select
        id={filter.key}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{filter.placeholder ?? "Tous"}</option>
        {grouped
          ? Array.from(grouped.entries()).map(([group, opts]) =>
              group ? (
                <optgroup key={group} label={group}>
                  {opts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ) : (
                opts.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              )
            )
          : filter.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
      </select>
    </div>
  );
}

function MultiSelectFilter({
  filter,
  values,
  onChange,
}: {
  filter: FilterDefinition;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(optValue: string): void {
    if (values.includes(optValue)) {
      onChange(values.filter((v) => v !== optValue));
    } else {
      onChange([...values, optValue]);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{filter.label}</Label>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-input p-2">
        {filter.options?.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2">
            <Checkbox
              id={`${filter.key}-${opt.value}`}
              checked={values.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
            />
            <label
              htmlFor={`${filter.key}-${opt.value}`}
              className="cursor-pointer text-sm leading-none"
            >
              {opt.label}
            </label>
          </div>
        ))}
        {(!filter.options || filter.options.length === 0) && (
          <p className="text-sm text-muted-foreground">Aucune option</p>
        )}
      </div>
    </div>
  );
}

function DateRangeFilter({
  filter,
  from,
  to,
  onChangeFrom,
  onChangeTo,
}: {
  filter: FilterDefinition;
  from: string;
  to: string;
  onChangeFrom: (value: string) => void;
  onChangeTo: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{filter.label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Du</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => onChangeFrom(e.target.value)}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Au</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => onChangeTo(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function AmountRangeFilter({
  filter,
  min,
  max,
  onChangeMin,
  onChangeMax,
}: {
  filter: FilterDefinition;
  min: string;
  max: string;
  onChangeMin: (value: string) => void;
  onChangeMax: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{filter.label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Min</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={min}
            onChange={(e) => onChangeMin(e.target.value)}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Max</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={max}
            onChange={(e) => onChangeMax(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export function FilterPanel({ filters, className }: FilterPanelProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const activeCount = countActiveFilters(filters, searchParams);

  const updateParam = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const resetAll = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const filter of filters) {
      const paramKey = getParamKey(filter.key);
      switch (filter.type) {
        case "select":
        case "multi-select":
          params.delete(paramKey);
          break;
        case "date-range":
          params.delete(`${paramKey}_from`);
          params.delete(`${paramKey}_to`);
          break;
        case "amount-range":
          params.delete(`${paramKey}_min`);
          params.delete(`${paramKey}_max`);
          break;
      }
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname, filters]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Filter className="h-4 w-4" />
          Filtres
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Filtres</SheetTitle>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAll}
                className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Reinitialiser
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {filters.map((filter) => {
            const paramKey = getParamKey(filter.key);

            switch (filter.type) {
              case "select":
                return (
                  <SelectFilter
                    key={filter.key}
                    filter={filter}
                    value={searchParams.get(paramKey) ?? ""}
                    onChange={(val) => updateParam(paramKey, val)}
                  />
                );

              case "multi-select": {
                const raw = searchParams.get(paramKey) ?? "";
                const values = raw ? raw.split(",") : [];
                return (
                  <MultiSelectFilter
                    key={filter.key}
                    filter={filter}
                    values={values}
                    onChange={(vals) =>
                      updateParam(paramKey, vals.join(","))
                    }
                  />
                );
              }

              case "date-range":
                return (
                  <DateRangeFilter
                    key={filter.key}
                    filter={filter}
                    from={searchParams.get(`${paramKey}_from`) ?? ""}
                    to={searchParams.get(`${paramKey}_to`) ?? ""}
                    onChangeFrom={(val) =>
                      updateParam(`${paramKey}_from`, val)
                    }
                    onChangeTo={(val) =>
                      updateParam(`${paramKey}_to`, val)
                    }
                  />
                );

              case "amount-range":
                return (
                  <AmountRangeFilter
                    key={filter.key}
                    filter={filter}
                    min={searchParams.get(`${paramKey}_min`) ?? ""}
                    max={searchParams.get(`${paramKey}_max`) ?? ""}
                    onChangeMin={(val) =>
                      updateParam(`${paramKey}_min`, val)
                    }
                    onChangeMax={(val) =>
                      updateParam(`${paramKey}_max`, val)
                    }
                  />
                );

              default:
                return null;
            }
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
