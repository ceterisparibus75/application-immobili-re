"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ChevronDown, User, Building2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ProprietaireEntityType } from "@/generated/prisma/client";

type ProprietaireItem = {
  id: string;
  label: string;
  entityType: ProprietaireEntityType;
  societyCount: number;
};

type Props = {
  proprietaires: ProprietaireItem[];
  activeId: string | null;
};

export function ProprietaireSelector({ proprietaires, activeId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = proprietaires.find((p) => p.id === activeId) ?? proprietaires[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectProprietaire(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pid", id);
    router.push(`/proprietaire?${params.toString()}`);
    setOpen(false);
  }

  if (proprietaires.length <= 1) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg hover:bg-muted/50 transition-colors"
      >
        {active?.entityType === "PERSONNE_MORALE" ? (
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        {active?.label ?? "Sélectionner"}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 py-1">
          {proprietaires.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProprietaire(p.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between ${
                p.id === activeId ? "bg-primary/5 text-primary font-medium" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                {p.entityType === "PERSONNE_MORALE" ? (
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                {p.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {p.societyCount} société{p.societyCount > 1 ? "s" : ""}
              </span>
            </button>
          ))}
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                router.push("/proprietaire/nouveau");
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2 text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau propriétaire
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
