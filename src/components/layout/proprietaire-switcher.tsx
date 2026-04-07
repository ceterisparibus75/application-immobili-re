"use client";

import { useState, useRef, useEffect } from "react";
import { useSociety } from "@/providers/society-provider";
import { getProprietairesWithSocieties } from "@/actions/proprietaire";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Check, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type ProprietaireData = {
  id: string;
  label: string;
  displayName: string;
  entityType: string;
  legalForm: string | null;
  societies: { id: string; name: string; legalForm: string; city: string; isActive: boolean; logoUrl: string | null }[];
};

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function ProprietaireSwitcher() {
  const { activeSociety, setActiveSociety } = useSociety();
  const router = useRouter();
  const [proprietaires, setProprietaires] = useState<ProprietaireData[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Charger les propriétaires
  useEffect(() => {
    let cancelled = false;
    getProprietairesWithSocieties().then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setProprietaires(result.data);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!loaded || proprietaires.length === 0) return null;

  // Trouver le propriétaire actif (celui qui contient la société active)
  const activeProprietaire = proprietaires.find((p) =>
    p.societies.some((s) => s.id === activeSociety?.id)
  ) ?? proprietaires[0];

  const canSwitch = proprietaires.length > 1;

  function handleSelectSociety(society: ProprietaireData["societies"][0]) {
    if (society.id === activeSociety?.id) {
      setOpen(false);
      return;
    }
    setActiveSociety(society as NonNullable<typeof activeSociety>);
    setOpen(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => canSwitch ? setOpen((v) => !v) : router.push("/proprietaire")}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors text-left",
          canSwitch ? "hover:bg-sidebar-accent cursor-pointer" : "hover:bg-sidebar-accent cursor-pointer",
        )}
      >
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="min-w-0 hidden md:block">
          <p className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
            {activeProprietaire.displayName}
          </p>
          {activeProprietaire.legalForm && (
            <p className="text-[10px] text-sidebar-muted leading-tight">
              {activeProprietaire.legalForm}
            </p>
          )}
        </div>
        {canSwitch && (
          <ChevronDown className={cn(
            "h-3 w-3 text-sidebar-muted shrink-0 transition-transform duration-150 hidden md:block",
            open && "rotate-180",
          )} />
        )}
      </button>

      {open && canSwitch && (
        <div className="absolute top-full left-0 mt-1 min-w-[280px] rounded-xl bg-white shadow-[0_4px_24px_rgba(12,35,64,0.12)] z-50 overflow-hidden">
          <div className="p-1.5 max-h-[400px] overflow-y-auto">
            {proprietaires.map((prop) => {
              const isActiveProp = prop.id === activeProprietaire.id;
              return (
                <div key={prop.id}>
                  {/* En-tête propriétaire */}
                  <div className="flex items-center gap-2 px-2 py-2 mt-1 first:mt-0">
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold select-none",
                      isActiveProp
                        ? "bg-brand-gradient-soft text-white"
                        : "bg-[#F3F4F6] text-[#0C2340]",
                    )}>
                      {getInitials(prop.displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-semibold truncate",
                        isActiveProp ? "text-[#1B4F8A]" : "text-[#0C2340]",
                      )}>
                        {prop.displayName}
                      </p>
                      {prop.legalForm && (
                        <p className="text-[10px] text-[#94A3B8]">{prop.legalForm}</p>
                      )}
                    </div>
                    {isActiveProp && (
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-gradient-soft">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Sociétés de ce propriétaire */}
                  <div className="ml-4 space-y-0.5">
                    {prop.societies.map((soc) => {
                      const isActiveSoc = soc.id === activeSociety?.id;
                      return (
                        <button
                          key={soc.id}
                          onClick={() => handleSelectSociety(soc)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                            isActiveSoc ? "bg-[#F0F9FF]" : "hover:bg-[#F9FAFB]",
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs truncate",
                              isActiveSoc ? "font-semibold text-[#1B4F8A]" : "text-[#374151]",
                            )}>
                              {soc.name}
                            </p>
                            <p className="text-[10px] text-[#94A3B8]">{soc.legalForm}</p>
                          </div>
                          {isActiveSoc && <Check className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-[#F1F5F9] p-1.5">
            <Link
              href="/proprietaire"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#94A3B8] hover:bg-[#F9FAFB] hover:text-[#64748B] transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Gérer les propriétaires</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
