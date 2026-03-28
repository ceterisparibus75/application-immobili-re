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

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2.5 h-9 w-72 px-3 rounded-lg border border-border/60 bg-secondary/50 text-sm text-muted-foreground hover:bg-secondary hover:border-border transition-all duration-150"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Rechercher...</span>
        <kbd className="text-[10px] bg-background/80 border border-border/50 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-border/60 bg-card shadow-2xl animate-fade-in-scale">
        <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher immeubles, locataires, factures..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          <kbd className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">Esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-96 overflow-y-auto p-2">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="mb-1.5">
                <p className="px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 font-medium">
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
                        selected === idx ? "bg-primary/8 text-foreground" : "hover:bg-accent/50"
                      )}
                      onClick={() => navigate(r)}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
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
          <div className="px-4 py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun resultat pour &laquo; {query} &raquo;</p>
          </div>
        )}

        <div className="border-t border-border/40 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/60">
          <span><kbd className="bg-secondary px-1 rounded font-mono">&#x2191;&#x2193;</kbd> Naviguer</span>
          <span><kbd className="bg-secondary px-1 rounded font-mono">&#x21B5;</kbd> Ouvrir</span>
          <span><kbd className="bg-secondary px-1 rounded font-mono">Esc</kbd> Fermer</span>
        </div>
      </div>
    </>
  );
}
