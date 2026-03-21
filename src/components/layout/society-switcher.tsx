"use client";

import { useSociety } from "@/providers/society-provider";
import { Building2, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function SocietySwitcher() {
  const { societies, activeSociety, setActiveSociety } = useSociety();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (societies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune société assignée
      </p>
    );
  }

  if (societies.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{societies[0].name}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-medium max-w-[200px] truncate">
          {activeSociety?.name ?? "Sélectionner une société"}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg z-50">
          <div className="p-1">
            {societies.map((society) => (
              <button
                key={society.id}
                onClick={() => {
                  setActiveSociety(society);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  society.id === activeSociety?.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="font-medium">{society.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {society.legalForm} — {society.city}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
