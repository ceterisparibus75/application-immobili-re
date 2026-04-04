"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SocietySwitcher } from "./society-switcher";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Propriétaire", href: "/proprietaire" },
  { name: "Patrimoine", href: "/patrimoine" },
  { name: "Baux", href: "/baux" },
  { name: "Locataires", href: "/locataires" },
  { name: "Facturation", href: "/facturation" },
  { name: "Charges", href: "/charges" },
  { name: "Banque", href: "/banque" },
  { name: "Emprunts", href: "/emprunts" },
  { name: "Comptabilité", href: "/comptabilite" },
  { name: "Prévisionnel", href: "/comptabilite/previsionnel" },
  { name: "Rapports", href: "/rapports" },
  { name: "Documents", href: "/documents" },
  { name: "Contacts", href: "/contacts" },
  { name: "Sociétés", href: "/societes" },
  { name: "RGPD", href: "/rgpd" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-sidebar text-sidebar-foreground border-b border-white/10">
      <div className="flex items-center h-11 px-4 gap-3">
        {/* Logo + Société */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white hidden md:block">GestImmo</span>
        </Link>

        <div className="hidden lg:block shrink-0">
          <SocietySwitcher />
        </div>

        {/* Séparateur */}
        <div className="h-5 w-px bg-white/15 hidden lg:block shrink-0" />

        {/* Navigation horizontale */}
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[12px] font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-white/55 hover:text-white/90 hover:bg-white/[0.07]"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
