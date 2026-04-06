"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  X,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string;
  details: Record<string, unknown> | null;
  user: { id: string; name: string | null; email: string } | null;
}

interface FilterOptions {
  entities: string[];
  users: { id: string; label: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  LOGIN: "Connexion",
  EXPORT: "Export",
  SEND_EMAIL: "Email envoyé",
  GENERATE_PDF: "PDF généré",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  CREATE: "success",
  UPDATE: "default",
  DELETE: "destructive",
  LOGIN: "secondary",
  EXPORT: "outline",
  SEND_EMAIL: "outline",
  GENERATE_PDF: "outline",
};

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "SEND_EMAIL", "GENERATE_PDF"];

function DetailView({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) return <span className="text-muted-foreground italic">Aucun détail</span>;

  return (
    <div className="space-y-1.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="font-mono font-medium text-muted-foreground shrink-0 w-32 text-right">{key}:</span>
          <span className="text-foreground break-all">
            {typeof value === "object" && value !== null
              ? JSON.stringify(value, null, 2)
              : String(value ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const { activeSociety } = useSociety();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ entities: [], users: [] });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Read state from URL
  const page = parseInt(searchParams.get("page") || "1", 10);
  const action = searchParams.get("action") || "";
  const entity = searchParams.get("entity") || "";
  const userId = searchParams.get("userId") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const search = searchParams.get("search") || "";

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

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (activeSociety) params.set("societyId", activeSociety.id);
    params.set("page", String(page));
    params.set("perPage", "30");
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (userId) params.set("userId", userId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search) params.set("search", search);
    return params.toString();
  }, [activeSociety, page, action, entity, userId, startDate, endDate, search]);

  useEffect(() => {
    if (!activeSociety) return;

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/audit?${buildQueryString()}`, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        setLogs(data.logs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        if (data.filterOptions) setFilterOptions(data.filterOptions);
      })
      .catch(() => {
        // Aborted or error
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [activeSociety, buildQueryString]);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    if (!activeSociety) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("societyId", activeSociety.id);
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
      if (userId) params.set("userId", userId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("search", search);

      const res = await fetch(`/api/audit/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error("Export failed");
    }
    setExporting(false);
  };

  const clearFilters = () => {
    updateParams({
      page: null,
      action: null,
      entity: null,
      userId: null,
      startDate: null,
      endDate: null,
      search: null,
    });
  };

  const hasFilters = !!(action || entity || userId || startDate || endDate || search);

  if (!activeSociety) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
        <p className="text-muted-foreground">
          Sélectionnez une société pour consulter les logs d&apos;audit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h1>
          <p className="text-muted-foreground">
            Historique des actions dans {activeSociety.name}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || total === 0}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exporter CSV
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value || null, page: "1" })}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <select
          value={action}
          onChange={(e) => updateParams({ action: e.target.value || null, page: "1" })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Toutes les actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>

        <select
          value={entity}
          onChange={(e) => updateParams({ entity: e.target.value || null, page: "1" })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Toutes les entités</option>
          {filterOptions.entities.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <select
          value={userId}
          onChange={(e) => updateParams({ userId: e.target.value || null, page: "1" })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tous les utilisateurs</option>
          {filterOptions.users.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>

        <Input
          type="date"
          value={startDate}
          onChange={(e) => updateParams({ startDate: e.target.value || null, page: "1" })}
          className="h-9 w-[140px] text-sm"
          placeholder="Du"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => updateParams({ endDate: e.target.value || null, page: "1" })}
          className="h-9 w-[140px] text-sm"
          placeholder="Au"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ScrollText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun log d&apos;audit{hasFilters ? " correspondant aux filtres" : ""}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-8" />
                    <TableHead className="text-[11px] uppercase tracking-wide font-semibold">Date</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide font-semibold">Utilisateur</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide font-semibold">Action</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide font-semibold">Entité</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide font-semibold">ID Entité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isExpanded = expandedRows.has(log.id);
                    return (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <TableCell className="w-8 px-2">
                            {log.details ? (
                              isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.user?.name || log.user?.email || "Système"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ACTION_VARIANTS[log.action] || "outline"}>
                              {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.entity}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.entityId}
                          </TableCell>
                        </TableRow>
                        {isExpanded && log.details && (
                          <TableRow key={`${log.id}-detail`}>
                            <TableCell />
                            <TableCell colSpan={5} className="bg-muted/30 py-3">
                              <DetailView details={log.details as Record<string, unknown>} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ── */}
      {!isLoading && logs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground px-1">
          <span>
            Affichage {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} sur {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => updateParams({ page: "1" })}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums text-sm font-medium text-foreground">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => updateParams({ page: String(totalPages) })}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
