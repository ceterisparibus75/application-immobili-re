"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Receipt, ScrollText, Mail, Bell, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SocietySwitcher } from "./society-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Éléments simples (lien direct) ──────────────────────────────

interface NavItem {
  name: string;
  href: string;
}

const NAV_ITEMS_BEFORE: NavItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Patrimoine", href: "/patrimoine" },
  { name: "Baux", href: "/baux" },
  { name: "Locataires", href: "/locataires" },
];

const NAV_ITEMS_AFTER: NavItem[] = [
  { name: "Banque", href: "/banque" },
  { name: "Emprunts", href: "/emprunts" },
  { name: "Comptabilité", href: "/comptabilite" },
  { name: "Prévisionnel", href: "/comptabilite/previsionnel" },
  { name: "Rapports", href: "/rapports" },
  { name: "Documents", href: "/documents" },
  { name: "Contacts", href: "/contacts" },
  { name: "Centre d'aide", href: "/aide" },
];

// ── Sous-items du menu "Gestion locative" ───────────────────────

const GESTION_LOCATIVE_ITEMS = [
  { name: "Facturation", href: "/facturation", icon: Receipt },
  { name: "Charges", href: "/charges", icon: ScrollText },
  { name: "Courriers", href: "/courriers", icon: Mail },
  { name: "Relances", href: "/relances", icon: Bell },
  { name: "Révisions / Indices", href: "/indices", icon: TrendingUp },
];

const GESTION_LOCATIVE_PATHS = GESTION_LOCATIVE_ITEMS.map((i) => i.href);

// ── Composant ───────────────────────────────────────────────────

export function TopNav() {
  const pathname = usePathname();

  const isGestionActive = GESTION_LOCATIVE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  return (
    <nav className="bg-sidebar border-b border-sidebar-border">
      <div className="flex items-center h-11 px-4 gap-3">
        {/* Logo + Société */}
        <Link href="/proprietaire" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <svg className="h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span className="text-sm font-bold text-sidebar-foreground hidden md:block">Propriétaire</span>
        </Link>

        <div className="hidden lg:block shrink-0">
          <SocietySwitcher />
        </div>

        {/* Séparateur */}
        <div className="h-5 w-px bg-sidebar-border hidden lg:block shrink-0" />

        {/* Navigation horizontale */}
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5">
            {/* Items avant le dropdown */}
            {NAV_ITEMS_BEFORE.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}

            {/* Menu déroulant Gestion locative */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap outline-none",
                  isGestionActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                Gestion locative
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {GESTION_LOCATIVE_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          isActive && "text-primary font-medium"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Items après le dropdown */}
            {NAV_ITEMS_AFTER.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      {item.name}
    </Link>
  );
}
