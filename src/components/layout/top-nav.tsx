"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown, Receipt, ScrollText, Mail, Bell, TrendingUp, FileText,
  Building2, Layers, Bot, Upload, Building, UmbrellaOff, UserSearch, Sparkles, Workflow,
  HelpCircle, BookOpen, Wallet, BarChart3, Plus, BookTemplate, BarChart, Package, MessageSquare,
  FolderLock,
} from "lucide-react";
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
];

// ── Sous-items du menu "Patrimoine" ──────────────────────────────

const PATRIMOINE_ITEMS = [
  { name: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
  { name: "Lots", href: "/patrimoine/lots", icon: Layers },
  { name: "Évaluations IA", href: "/patrimoine/evaluations", icon: Bot },
];

const PATRIMOINE_PATHS = ["/patrimoine"];

// ── Sous-items du menu "Baux" ──────────────────────────────────

const BAUX_ITEMS = [
  { name: "Tous les baux", href: "/baux", icon: FileText },
  { name: "Nouveau bail", href: "/baux/nouveau", icon: Plus },
  { name: "Import bail PDF", href: "/baux/import", icon: Upload },
  { name: "Modèles de bail", href: "/baux/modeles", icon: BookTemplate },
  { name: "Révisions de loyer", href: "/baux/revisions", icon: TrendingUp },
  { name: "Indices INSEE", href: "/indices", icon: BarChart },
];

const BAUX_PATHS = ["/baux", "/indices"];

const NAV_ITEMS_AFTER_BAUX: NavItem[] = [
  { name: "Locataires", href: "/locataires" },
];

const NAV_ITEMS_AFTER: NavItem[] = [
  { name: "Banque", href: "/banque" },
  { name: "Emprunts", href: "/emprunts" },
  { name: "Rapports", href: "/rapports" },
  { name: "Documents", href: "/documents" },
  { name: "Contacts", href: "/contacts" },
];

// ── Sous-items du menu "Gestion locative" ───────────────────────

const GESTION_LOCATIVE_ITEMS = [
  { name: "Facturation", href: "/facturation", icon: Receipt },
  { name: "Factures fourn.", href: "/banque/factures-fournisseurs", icon: Package },
  { name: "Charges", href: "/charges", icon: ScrollText },
  { name: "Décomptes gestion", href: "/releves-gestion", icon: FileText },
  { name: "Courriers", href: "/courriers", icon: Mail },
  { name: "Relances", href: "/relances", icon: Bell },
  { name: "Candidatures", href: "/candidatures", icon: UserSearch },
  { name: "Tickets", href: "/tickets", icon: MessageSquare },
];

const GESTION_LOCATIVE_PATHS = [...GESTION_LOCATIVE_ITEMS.map((i) => i.href), "/parametres/facturation", "/tickets"];

// ── Sous-items du menu "Modules" ────────────────────────────────

const MODULES_ITEMS = [
  { name: "Copropriété", href: "/copropriete", icon: Building },
  { name: "Saisonnier", href: "/saisonnier", icon: UmbrellaOff },
  { name: "Assistant IA", href: "/assistant", icon: Sparkles },
  { name: "Workflows", href: "/workflows", icon: Workflow },
  { name: "Import données", href: "/import", icon: Upload },
  { name: "Dataroom", href: "/dataroom", icon: FolderLock },
];

const MODULES_PATHS = MODULES_ITEMS.map((i) => i.href);

// ── Sous-items du menu "Finances" ──────────────────────────────

const FINANCES_ITEMS = [
  { name: "Comptabilité", href: "/comptabilite", icon: BookOpen },
  { name: "Cash-flow", href: "/comptabilite/cashflow", icon: Wallet },
  { name: "Prévisionnel", href: "/comptabilite/previsionnel", icon: BarChart3 },
];

const FINANCES_PATHS = FINANCES_ITEMS.map((i) => i.href);

// ── Lien "Centre d'aide" (remplace l'ancien dropdown Administration) ──

// ── Composant ───────────────────────────────────────────────────

export function TopNav() {
  const pathname = usePathname();

  const isPatrimoineActive = PATRIMOINE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isBauxActive = BAUX_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isGestionActive = GESTION_LOCATIVE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isModulesActive = MODULES_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isFinancesActive = FINANCES_PATHS.some(
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

            {/* Menu déroulant Patrimoine */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap outline-none",
                  isPatrimoineActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                Patrimoine
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {PATRIMOINE_ITEMS.map((item) => {
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

            {/* Menu déroulant Modules */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap outline-none",
                  isModulesActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                Modules
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {MODULES_ITEMS.map((item) => {
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

            {/* Menu déroulant Finances */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap outline-none",
                  isFinancesActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                Finances
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {FINANCES_ITEMS.map((item) => {
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

            {/* Items après les dropdowns */}
            {NAV_ITEMS_AFTER.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}

            {/* Lien Centre d'aide */}
            <Link
              href="/aide"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                pathname === "/aide" || pathname.startsWith("/aide/")
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Centre d&apos;aide
            </Link>
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
