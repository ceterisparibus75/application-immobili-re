"use client";

import { createContext, useContext, useEffect, useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus, FileText, Building2, Users, Receipt, CreditCard,
  Download, Keyboard, Home, BarChart3, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Shortcut {
  /** Identifiant unique */
  id: string;
  /** Libellé affiché dans la palette */
  label: string;
  /** Catégorie pour le regroupement */
  category: "navigation" | "creation" | "action";
  /** Icône Lucide */
  icon: React.ElementType;
  /** Combinaison affichée (ex: "Ctrl+N") */
  keys?: string;
  /** Action à exécuter */
  action: () => void;
  /** Condition d'affichage (optionnel) */
  when?: () => boolean;
}

interface ShortcutsContextValue {
  openPalette: () => void;
  closePalette: () => void;
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (id: string) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcuts must be used within KeyboardShortcutsProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Palette de commandes                                               */
/* ------------------------------------------------------------------ */

function CommandPalette({
  open,
  onClose,
  shortcuts,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = { current: null as HTMLInputElement | null };

  // Filtrer les raccourcis visibles et correspondant à la recherche
  const visible = shortcuts
    .filter((s) => !s.when || s.when())
    .filter(
      (s) =>
        query.length === 0 ||
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.category.toLowerCase().includes(query.toLowerCase())
    );

  // Grouper par catégorie
  const grouped: Record<string, Shortcut[]> = {};
  for (const s of visible) {
    (grouped[s.category] ??= []).push(s);
  }

  const flatList = visible;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flatList.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter" && flatList[selected]) {
      flatList[selected].action();
      onClose();
    }
    if (e.key === "Escape") onClose();
  };

  const CATEGORY_LABELS: Record<string, string> = {
    navigation: "Navigation",
    creation: "Créer",
    action: "Actions",
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-[15%] z-[60] w-full max-w-md -translate-x-1/2 rounded-2xl border border-border/40 bg-card shadow-2xl animate-fade-in-scale overflow-hidden">
        {/* Barre de recherche */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30">
          <Keyboard className="h-4 w-4 text-primary/60 shrink-0" />
          <input
            ref={(el) => { inputRef.current = el; }}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Tapez une commande..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Liste des commandes */}
        <div className="max-h-72 overflow-y-auto py-2 px-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-1">
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50 font-semibold">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              {items.map((shortcut) => {
                const idx = flatList.indexOf(shortcut);
                const Icon = shortcut.icon;
                return (
                  <button
                    key={shortcut.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-100",
                      selected === idx ? "bg-primary/8 text-foreground" : "hover:bg-accent/50 text-foreground/80"
                    )}
                    onClick={() => { shortcut.action(); onClose(); }}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">{shortcut.label}</span>
                    {shortcut.keys && (
                      <kbd className="text-[10px] bg-secondary border border-border/40 px-1.5 py-0.5 rounded font-mono text-muted-foreground/50">
                        {shortcut.keys}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {flatList.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground/50">
              Aucune commande trouvée
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 px-5 py-2 flex items-center gap-5 text-[10px] text-muted-foreground/40">
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">↑↓</kbd> Naviguer</span>
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">↵</kbd> Exécuter</span>
          <span><kbd className="bg-secondary/80 px-1 rounded font-mono">Esc</kbd> Fermer</span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<Shortcut[]>([]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setCustomShortcuts((prev) => {
      const filtered = prev.filter((s) => s.id !== shortcut.id);
      return [...filtered, shortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setCustomShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Raccourcis globaux par défaut
  const defaultShortcuts: Shortcut[] = [
    // Navigation
    {
      id: "nav-dashboard",
      label: "Tableau de bord",
      category: "navigation",
      icon: Home,
      action: () => router.push("/dashboard"),
    },
    {
      id: "nav-patrimoine",
      label: "Patrimoine",
      category: "navigation",
      icon: Building2,
      action: () => router.push("/patrimoine"),
    },
    {
      id: "nav-baux",
      label: "Baux",
      category: "navigation",
      icon: FileText,
      action: () => router.push("/baux"),
    },
    {
      id: "nav-locataires",
      label: "Locataires",
      category: "navigation",
      icon: Users,
      action: () => router.push("/locataires"),
    },
    {
      id: "nav-facturation",
      label: "Facturation",
      category: "navigation",
      icon: Receipt,
      action: () => router.push("/facturation"),
    },
    {
      id: "nav-banque",
      label: "Banque",
      category: "navigation",
      icon: Landmark,
      action: () => router.push("/banque"),
    },
    {
      id: "nav-comptabilite",
      label: "Comptabilité",
      category: "navigation",
      icon: BarChart3,
      action: () => router.push("/comptabilite"),
    },
    // Création
    {
      id: "create-building",
      label: "Nouvel immeuble",
      category: "creation",
      icon: Plus,
      keys: "Ctrl+N",
      action: () => router.push("/patrimoine/immeubles/nouveau"),
    },
    {
      id: "create-lease",
      label: "Nouveau bail",
      category: "creation",
      icon: Plus,
      action: () => router.push("/baux/nouveau"),
    },
    {
      id: "create-tenant",
      label: "Nouveau locataire",
      category: "creation",
      icon: Plus,
      action: () => router.push("/locataires/nouveau"),
    },
    {
      id: "create-invoice",
      label: "Nouvelle facture",
      category: "creation",
      icon: Plus,
      action: () => router.push("/facturation/nouvelle"),
    },
    {
      id: "create-charge",
      label: "Nouvelle charge",
      category: "creation",
      icon: Plus,
      action: () => router.push("/charges/nouvelle"),
    },
    {
      id: "create-contact",
      label: "Nouveau contact",
      category: "creation",
      icon: Plus,
      action: () => router.push("/contacts/nouveau"),
    },
    // Actions
    {
      id: "action-generate-invoices",
      label: "Générer les factures",
      category: "action",
      icon: Receipt,
      action: () => router.push("/facturation/generer"),
    },
    {
      id: "action-export-fec",
      label: "Export FEC",
      category: "action",
      icon: Download,
      action: () => router.push("/comptabilite/exports"),
    },
    {
      id: "action-bank-reconciliation",
      label: "Rapprochement bancaire",
      category: "action",
      icon: CreditCard,
      when: () => pathname.startsWith("/banque"),
      action: () => {
        // Trouver l'ID du compte bancaire depuis l'URL si on est déjà sur /banque/[id]
        const match = pathname.match(/^\/banque\/([^/]+)/);
        if (match) router.push(`/banque/${match[1]}/rapprochement`);
      },
    },
  ];

  const allShortcuts = [...defaultShortcuts, ...customShortcuts];

  // Raccourcis clavier globaux
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Ctrl+Shift+P ou Ctrl+J : Palette de commandes
      if (mod && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      // ? : Aide raccourcis (sauf si dans un input)
      if (e.key === "?" && !isInput && !mod) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Ctrl+N : Création contextuelle
      if (mod && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        if (pathname.startsWith("/patrimoine")) router.push("/patrimoine/immeubles/nouveau");
        else if (pathname.startsWith("/baux")) router.push("/baux/nouveau");
        else if (pathname.startsWith("/locataires")) router.push("/locataires/nouveau");
        else if (pathname.startsWith("/facturation")) router.push("/facturation/nouvelle");
        else if (pathname.startsWith("/charges")) router.push("/charges/nouvelle");
        else if (pathname.startsWith("/contacts")) router.push("/contacts/nouveau");
        else if (pathname.startsWith("/emprunts")) router.push("/emprunts/nouveau");
        else setPaletteOpen(true); // Fallback : ouvrir la palette
        return;
      }

      // Ctrl+E : Exporter (déclenche le bouton export s'il existe)
      if (mod && e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        const exportBtn = document.querySelector<HTMLButtonElement>("[data-export-button]");
        if (exportBtn) exportBtn.click();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pathname, router]);

  return (
    <ShortcutsContext.Provider value={{ openPalette, closePalette, registerShortcut, unregisterShortcut }}>
      {children}
      <CommandPalette open={paletteOpen} onClose={closePalette} shortcuts={allShortcuts} />
    </ShortcutsContext.Provider>
  );
}
