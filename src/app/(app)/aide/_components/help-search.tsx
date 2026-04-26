"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, BookOpen, HelpCircle } from "lucide-react";
import Link from "next/link";

type SearchableGuide = { slug: string; title: string; description: string };
type SearchableFaq = { q: string; a: string };

export function HelpSearch({ guides, faqs }: { guides: SearchableGuide[]; faqs: SearchableFaq[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const hasQuery = q.length >= 2;

  const matchingGuides = hasQuery
    ? guides.filter((g) => g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))
    : [];

  const matchingFaqs = hasQuery
    ? faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)).slice(0, 5)
    : [];

  const hasResults = matchingGuides.length > 0 || matchingFaqs.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function highlight(text: string): React.ReactNode {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 dark:bg-yellow-900/40 rounded px-0.5 not-italic font-inherit">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher dans les guides et la FAQ…"
          className="w-full pl-12 pr-12 py-3.5 rounded-xl border bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && hasQuery && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-background border rounded-xl shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
          {!hasResults ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun résultat pour{" "}
                <span className="font-medium text-foreground">« {query} »</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Consultez{" "}
                <Link href="/aide/depannage" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                  la page de dépannage
                </Link>{" "}
                ou{" "}
                <Link href="/contact" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                  contactez le support
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {matchingGuides.length > 0 && (
                <div className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">
                    Guides ({matchingGuides.length})
                  </p>
                  {matchingGuides.map((g) => (
                    <Link
                      key={g.slug}
                      href={`/aide/${g.slug}`}
                      onClick={() => { setQuery(""); setOpen(false); }}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
                    >
                      <BookOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">
                          {highlight(g.title)}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {highlight(g.description)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {matchingFaqs.length > 0 && (
                <div className={`p-3 ${matchingGuides.length > 0 ? "border-t" : ""}`}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">
                    FAQ ({matchingFaqs.length})
                  </p>
                  {matchingFaqs.map((f) => (
                    <div key={f.q} className="p-2.5 rounded-lg">
                      <p className="text-sm font-medium flex items-start gap-2">
                        <HelpCircle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                        <span>{highlight(f.q)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 ml-6 line-clamp-2">{f.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
