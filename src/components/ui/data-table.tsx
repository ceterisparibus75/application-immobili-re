"use client";

import { Fragment, useCallback, useRef, useState, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  CheckSquare,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/* ────────────────────────── Types ────────────────────────── */

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface GroupInfo {
  key: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
}

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  action: (selectedRows: T[]) => void | Promise<void>;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filters?: FilterOption[];
  activeFilters?: Record<string, string>;
  isLoading?: boolean;
  /** Link builder for row click (optional) */
  rowHref?: (row: T) => string;
  /** Key extractor */
  rowKey: (row: T) => string;
  /** Empty state */
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  /** Optional grouping: extract group info from each row to render section headers */
  groupBy?: (row: T) => GroupInfo;
  /** Enable row selection with checkboxes */
  selectable?: boolean;
  /** Bulk actions displayed when rows are selected */
  bulkActions?: BulkAction<T>[];
}

/* ────────────────────────── Component ────────────────────────── */

const PAGE_SIZES = [10, 25, 50, 100];

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  sortBy,
  sortOrder,
  search,
  filters,
  activeFilters,
  isLoading,
  rowHref,
  rowKey,
  emptyMessage = "Aucun résultat",
  emptyIcon,
  groupBy,
  selectable,
  bulkActions,
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Selection helpers
  const allKeys = useMemo(() => data.map((r) => rowKey(r)), [data, rowKey]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys.has(k));
  const someSelected = allKeys.some((k) => selectedKeys.has(k));

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const k of allKeys) next.delete(k);
      } else {
        for (const k of allKeys) next.add(k);
      }
      return next;
    });
  }, [allKeys, allSelected]);

  const toggleOne = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), []);

  const selectedRows = useMemo(
    () => data.filter((r) => selectedKeys.has(rowKey(r))),
    [data, selectedKeys, rowKey],
  );

  const handleBulkAction = useCallback(
    async (action: BulkAction<T>) => {
      setBulkLoading(true);
      try {
        await action.action(selectedRows);
        clearSelection();
      } finally {
        setBulkLoading(false);
      }
    },
    [selectedRows, clearSelection],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParams({ search: value || null, page: "1" });
      }, 300);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (key: string) => {
      const newOrder = sortBy === key && sortOrder === "asc" ? "desc" : "asc";
      updateParams({ sortBy: key, sortOrder: newOrder, page: "1" });
    },
    [sortBy, sortOrder, updateParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams({ page: String(newPage) });
    },
    [updateParams]
  );

  const handlePageSize = useCallback(
    (size: number) => {
      updateParams({ pageSize: String(size), page: "1" });
    },
    [updateParams]
  );

  const handleFilter = useCallback(
    (key: string, value: string) => {
      updateParams({ [`filter_${key}`]: value || null, page: "1" });
    },
    [updateParams]
  );

  const clearFilters = useCallback(() => {
    const updates: Record<string, null> = { search: null, page: null };
    if (filters) {
      for (const f of filters) updates[`filter_${f.key}`] = null;
    }
    updateParams(updates);
    setSearchValue("");
  }, [filters, updateParams]);

  const hasActiveFilters =
    !!search || Object.values(activeFilters ?? {}).some(Boolean);

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Filters */}
        {filters?.map((filter) => (
          <select
            key={filter.key}
            value={activeFilters?.[filter.key] ?? ""}
            onChange={(e) => handleFilter(filter.key, e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selectable && selectedKeys.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 animate-in slide-in-from-top-1 duration-200">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {selectedKeys.size} élément{selectedKeys.size > 1 ? "s" : ""} sélectionné{selectedKeys.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {bulkActions.map((ba) => (
              <Button
                key={ba.id}
                variant={ba.variant ?? "outline"}
                size="sm"
                className="h-8 text-xs"
                disabled={bulkLoading}
                onClick={() => handleBulkAction(ba)}
              >
                {ba.icon}
                <span className="ml-1.5">{ba.label}</span>
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearSelection}>
              <X className="h-3.5 w-3.5 mr-1" />
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {selectable && (
                <TableHead className="w-[40px] px-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Sélectionner tout"
                    className={someSelected && !allSelected ? "opacity-60" : ""}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`text-[11px] uppercase tracking-wide font-semibold ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                  } ${col.sortable ? "cursor-pointer select-none" : ""} ${col.className ?? ""}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortBy === col.key && (
                      sortOrder === "asc"
                        ? <ArrowUp className="h-3 w-3" />
                        : <ArrowDown className="h-3 w-3" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
                <TableRow key={i}>
                  {selectable && (
                    <TableCell className="px-3"><Skeleton className="h-4 w-4" /></TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {emptyIcon}
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                let lastGroupKey: string | null = null;
                return data.map((row, i) => {
                  const key = rowKey(row);
                  const href = rowHref?.(row);
                  const group = groupBy?.(row);
                  const showGroupHeader = group && group.key !== lastGroupKey;
                  if (group) lastGroupKey = group.key;

                  const isSelected = selectable && selectedKeys.has(key);
                  return (
                    <Fragment key={key}>
                      {showGroupHeader && group && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              {group.icon}
                              <span className="font-semibold text-sm text-foreground">{group.label}</span>
                              {group.sublabel && (
                                <span className="text-xs text-muted-foreground">{group.sublabel}</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow
                        className={cn(
                          href ? "cursor-pointer" : "",
                          isSelected ? "bg-primary/5" : "",
                        )}
                        onClick={href && !selectable ? () => router.push(href) : undefined}
                      >
                        {selectable && (
                          <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(key)}
                              aria-label={`Sélectionner la ligne ${i + 1}`}
                            />
                          </TableCell>
                        )}
                        {columns.map((col) => (
                          <TableCell
                            key={col.key}
                            className={`${
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                            } ${col.className ?? ""}`}
                            onClick={href && selectable ? () => router.push(href) : undefined}
                          >
                            {col.render(row, i)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </Fragment>
                  );
                });
              })()
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          <span>
            {total > 0
              ? `Affichage ${from}–${to} sur ${total}`
              : "Aucun résultat"}
          </span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => handlePageChange(1)}
            aria-label="Première page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums text-sm font-medium text-foreground">
            {page} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(totalPages)}
            aria-label="Dernière page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
