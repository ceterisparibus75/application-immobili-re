"use client";

import { useSociety } from "@/providers/society-provider";
import { ChevronDown, Check, Settings } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
  "bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
          canSwitch ? "hover:bg-sidebar-accent cursor-pointer" : "cursor-default",
        )}
      >
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold select-none shadow-sm", avatarColor(activeSociety.name))}>
          {getInitials(activeSociety.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-tight truncate text-sidebar-foreground">{activeSociety.name}</p>
          <p className="text-[10px] leading-tight text-sidebar-muted/60 truncate">{activeSociety.legalForm}</p>
        </div>
        {canSwitch && (
          <ChevronDown className={cn("h-3 w-3 text-sidebar-muted/50 shrink-0 transition-transform duration-150", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card text-card-foreground shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Changer de société
            </p>
            {societies.map((s) => {
              const isActive = s.id === activeSociety.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSwitch(s)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors", isActive ? "bg-primary/10" : "hover:bg-accent")}
                >
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white text-[10px] font-bold shadow-sm", avatarColor(s.name))}>
                    {getInitials(s.name)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={cn("font-medium truncate leading-tight text-sm", isActive && "text-primary")}>{s.name}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{s.legalForm} · {s.city}</p>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="border-t p-1.5">
            <Link
              href={`/societes/${activeSociety.id}/modifier`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Modifier la société</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
