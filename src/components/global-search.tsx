"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Building2, Home, Users, FileText, Receipt, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

const TYPE_ICONS: Record<string, React.ElementType> = {
  building: Building2,
  lot: Home,
  tenant: Users,
  lease: FileText,
  invoice: Receipt,
  contact: UserCircle,
  document: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  building: "Immeuble",
  lot: "Lot",
  tenant: "Locataire",
  lease: "Bail",
  invoice: "Facture",
  contact: "Contact",
  document: "Document",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const json = await res.json() as { data: SearchResult[] };
      setResults(json.data);
      setSelected(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const navigate = (result: SearchResult) => {
    router.push(result.href);
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected]);
  };

  // Grouper par type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Rechercher...</span>
        <kbd className="ml-6 text-xs bg-muted px-1 py-0.5 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher immeubles, locataires, factures..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-96 overflow-y-auto p-2">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="mb-2">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {TYPE_LABELS[type] ?? type}
                </p>
                {items.map((r) => {
                  const Icon = TYPE_ICONS[r.type] ?? FileText;
                  const idx = results.indexOf(r);
                  return (
                    <button
                      key={r.id}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                        selected === idx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                      onClick={() => navigate(r)}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                      </div>
                      {r.meta && <span className="text-xs text-muted-foreground shrink-0">{r.meta}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">Aucun résultat pour « {query} »</p>
        )}

        <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="bg-muted px-1 rounded">↑↓</kbd> Naviguer</span>
          <span><kbd className="bg-muted px-1 rounded">↵</kbd> Ouvrir</span>
          <span><kbd className="bg-muted px-1 rounded">Esc</kbd> Fermer</span>
        </div>
      </div>
    </>
  );
}
