"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Receipt, ScrollText, Mail, Bell, TrendingUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SocietySwitcher } from "./society-switcher";
import { ProprietaireSwitcher } from "./proprietaire-switcher";
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
];

const NAV_ITEMS_AFTER_BAUX: NavItem[] = [
  { name: "Locataires", href: "/locataires" },
];

// ── Sous-items du menu "Baux" ──────────────────────────────────

const BAUX_ITEMS = [
  { name: "Liste des baux", href: "/baux", icon: FileText },
  { name: "Révisions / Indices", href: "/indices", icon: TrendingUp },
];

const BAUX_PATHS = ["/baux", "/indices"];

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
];

const GESTION_LOCATIVE_PATHS = GESTION_LOCATIVE_ITEMS.map((i) => i.href);

// ── Composant ───────────────────────────────────────────────────

export function TopNav() {
  const pathname = usePathname();

  const isBauxActive = BAUX_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isGestionActive = GESTION_LOCATIVE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  return (
    <nav className="bg-sidebar border-b border-sidebar-border">
      <div className="flex items-center h-11 px-4 gap-3">
        {/* Propriétaire switcher */}
        <div className="shrink-0">
          <ProprietaireSwitcher />
        </div>

        <div className="hidden lg:block shrink-0">
          <SocietySwitcher />
        </div>

        {/* Séparateur */}
        <div className="h-5 w-px bg-sidebar-border hidden lg:block shrink-0" />

        {/* Navigation horizontale */}
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5">
            {/* Items avant les dropdowns */}
            {NAV_ITEMS_BEFORE.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}

            {/* Menu déroulant Baux */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap outline-none",
                  isBauxActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                Baux
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {BAUX_ITEMS.map((item) => {
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

            {NAV_ITEMS_AFTER_BAUX.map((item) => (
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
