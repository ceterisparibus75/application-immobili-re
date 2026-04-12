"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Building2, Home, Users, FileText, Receipt,
  UserCircle, Clock, X, Filter, FileIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_ICONS: Record<string, React.ElementType> = {
  building: Building2, lot: Home, tenant: Users, lease: FileText,
  invoice: Receipt, contact: UserCircle, document: FileIcon,
};
const TYPE_LABELS: Record<string, string> = {
  building: "Immeuble", lot: "Lot", tenant: "Locataire", lease: "Bail",
  invoice: "Facture", contact: "Contact", document: "Document",
};
const TYPE_COLORS: Record<string, string> = {
  building: "bg-blue-500/10 text-blue-600",
  lot: "bg-emerald-500/10 text-emerald-600",
  tenant: "bg-violet-500/10 text-violet-600",
  lease: "bg-amber-500/10 text-amber-600",
  invoice: "bg-rose-500/10 text-rose-600",
  contact: "bg-cyan-500/10 text-cyan-600",
  document: "bg-slate-500/10 text-slate-600",
};

const HISTORY_KEY = "mygestia-search-history";
const MAX_HISTORY = 8;

/* ------------------------------------------------------------------ */
/*  History helpers                                                     */
/* ------------------------------------------------------------------ */

interface HistoryEntry {
  id: string;
  type: string;
  title: string;
  href: string;
  timestamp: number;
}

function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToHistory(result: SearchResult): void {
  const history = getHistory().filter((h) => h.id !== result.id);
  history.unshift({
    id: result.id,
    type: result.type,
    title: result.title,
    href: result.href,
    timestamp: Date.now(),
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Charger l'historique à l'ouverture
  useEffect(() => {
    if (open) {
      setHistory(getHistory());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Raccourci Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(async (q: string, type: string | null) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (type) params.set("type", type);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) return;
      const json = await res.json() as { data: SearchResult[] };
      setResults(json.data);
      setSelected(0);
    } finally { setLoading(false); }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val, filterType), 250);
  };

  const handleFilterChange = (type: string | null) => {
    setFilterType(type);
    if (query.length >= 2) {
      search(query, type);
    }
  };

  const navigate = (result: SearchResult) => {
    addToHistory(result);
    router.push(result.href);
    setOpen(false); setQuery(""); setResults([]); setFilterType(null);
  };

  const navigateHistory = (entry: HistoryEntry) => {
    router.push(entry.href);
    setOpen(false); setQuery(""); setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const list = showHistory ? history : results;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, list.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter") {
      if (showHistory && history[selected]) navigateHistory(history[selected]);
      else if (results[selected]) navigate(results[selected]);
    }
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const showHistory = query.length < 2 && history.length > 0;
  const showResults = query.length >= 2 && results.length > 0;
  const showEmpty = query.length >= 2 && results.length === 0 && !loading;

  // Filters chips
  const filterTypes = ["building", "lot", "tenant", "lease", "invoice", "contact"];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2.5 h-9 w-80 px-3.5 rounded-lg bg-sidebar/[0.04] border border-border/50 text-sm text-muted-foreground hover:bg-accent hover:border-border transition-all duration-150"
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="flex-1 text-left text-muted-foreground/70">Rechercher...</span>
        <kbd className="text-[10px] bg-secondary border border-border/40 px-1.5 py-0.5 rounded font-mono text-muted-foreground/50">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-[12%] z-50 w-full max-w-lg -translate-x-1/2 rounded-2xl border border-border/40 bg-card shadow-2xl animate-fade-in-scale overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Search className="h-5 w-5 text-primary/60 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher immeubles, locataires, factures..."
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/40"
          />
          {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); }} className="text-muted-foreground/40 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-5 pb-3 overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          <button
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap",
              !filterType ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            )}
            onClick={() => handleFilterChange(null)}
          >
            Tout
          </button>
          {filterTypes.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap",
                  filterType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                )}
                onClick={() => handleFilterChange(filterType === type ? null : type)}
              >
                <Icon className="h-3 w-3" />
                {TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>

        {/* History */}
        {showHistory && (
          <div className="border-t border-border/40 px-2 py-2 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">
                Recherches récentes
              </p>
              <button
                onClick={() => { clearHistory(); setHistory([]); }}
                className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                Effacer
              </button>
            </div>
            {history.map((entry, idx) => {
              const Icon = TYPE_ICONS[entry.type] ?? FileText;
              return (
                <button
                  key={entry.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-100",
                    selected === idx ? "bg-primary/8" : "hover:bg-accent/50"
                  )}
                  onClick={() => navigateHistory(entry)}
                  onMouseEnter={() => setSelected(idx)}
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                  <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", TYPE_COLORS[entry.type] ?? "bg-secondary")}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-sm truncate">{entry.title}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/30">{TYPE_LABELS[entry.type]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search results */}
        {showResults && (
          <div className="max-h-80 overflow-y-auto border-t border-border/40 px-2 py-2">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="mb-1">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60 font-semibold">
                  {TYPE_LABELS[type] ?? type}
                  <span className="ml-1.5 text-muted-foreground/30">({items.length})</span>
                </p>
                {items.map((r) => {
                  const Icon = TYPE_ICONS[r.type] ?? FileText;
                  const idx = results.indexOf(r);
                  return (
                    <button
                      key={r.id}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-100",
                        selected === idx ? "bg-primary/8" : "hover:bg-accent/50"
                      )}
                      onClick={() => navigate(r)}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", TYPE_COLORS[r.type] ?? "bg-secondary")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-muted-foreground/70 truncate">{r.subtitle}</p>}
                      </div>
                      {r.meta && <span className="text-[11px] text-muted-foreground/50 shrink-0 tabular-nums">{r.meta}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="border-t border-border/40 px-5 py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/60">Aucun résultat pour &laquo; {query} &raquo;</p>
            {filterType && (
              <button
                onClick={() => handleFilterChange(null)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Rechercher dans toutes les catégories
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/30 px-5 py-2.5 flex items-center gap-5 text-[10px] text-muted-foreground/40">
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">&#x2191;&#x2193;</kbd> Naviguer</span>
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">&#x21B5;</kbd> Ouvrir</span>
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">Tab</kbd> Filtrer</span>
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">Esc</kbd> Fermer</span>
        </div>
      </div>
    </>
  );
}
