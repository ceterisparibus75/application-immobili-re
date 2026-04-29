"use client";

import { useSociety } from "@/providers/society-provider";
import { ChevronDown, Check, Settings } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LEGAL_FORM_LABELS } from "@/lib/constants";

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function SocietySwitcher() {
  const { societies, activeSociety, setActiveSociety } = useSociety();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!activeSociety) return null;
  const canSwitch = societies.length > 1;

  function handleSwitch(society: NonNullable<typeof activeSociety>) {
    if (society.id === activeSociety?.id) { setOpen(false); return; }
    setActiveSociety(society);
    setOpen(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors text-left",
          canSwitch ? "hover:bg-accent/50 cursor-pointer" : "cursor-default",
        )}
      >
        {/* Avatar actif : dégradé brand */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold select-none bg-brand-gradient-soft">
          {getInitials(activeSociety.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight truncate text-foreground">{activeSociety.name}</p>
          <p className="text-[10px] leading-tight text-muted-foreground truncate">{LEGAL_FORM_LABELS[activeSociety.legalForm] ?? activeSociety.legalForm}</p>
        </div>
        {canSwitch && (
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-150", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl bg-popover shadow-[0_4px_24px_rgba(12,35,64,0.12)] z-50 overflow-hidden min-w-full w-max max-w-72 border border-border/50">
          <div className="p-1.5">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Changer de société
            </p>
            {societies.map((s) => {
              const isActive = s.id === activeSociety.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSwitch(s)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                    isActive ? "bg-primary/10" : "hover:bg-accent/50",
                  )}
                >
                  {/* Avatar : gris neutre par défaut, dégradé brand si actif */}
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold select-none",
                    isActive
                      ? "bg-brand-gradient-soft text-white"
                      : "bg-muted text-foreground",
                  )}>
                    {getInitials(s.name)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={cn(
                      "font-semibold truncate leading-tight text-sm",
                      isActive ? "text-primary" : "text-foreground",
                    )}>{s.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{LEGAL_FORM_LABELS[s.legalForm] ?? s.legalForm} · {s.city}</p>
                  </div>
                  {isActive && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gradient-soft">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border p-1.5">
            <Link
              href={`/societes/${activeSociety.id}/modifier`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Modifier la société</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
