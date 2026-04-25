"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_ITEM,
  TOP_NAV_GROUPS,
  type NavGroup,
  type NavItem,
} from "./navigation-config";
import { ProprietaireSwitcher } from "./proprietaire-switcher";
import { SocietySwitcher } from "./society-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GROUP_ROOTS: Record<string, string[]> = {
  Patrimoine: ["/patrimoine", "/societes", "/proprietaire"],
  Location: ["/baux", "/locataires", "/facturation", "/charges", "/relances", "/candidatures", "/tickets"],
  Finances: ["/banque", "/emprunts", "/comptabilite", "/rapports", "/indices"],
  Documents: ["/documents", "/dataroom", "/courriers", "/releves-gestion", "/import"],
  Automatisation: ["/assistant", "/workflows", "/api-docs"],
};

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden border-b border-sidebar-border bg-sidebar lg:block">
      <div className="flex h-11 items-center gap-3 px-4">
        <div className="shrink-0">
          <ProprietaireSwitcher />
        </div>

        <div className="shrink-0">
          <SocietySwitcher />
        </div>

        <div className="h-5 w-px shrink-0 bg-sidebar-border" />

        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5">
            <NavLink item={DASHBOARD_ITEM} pathname={pathname} />

            {TOP_NAV_GROUPS.map((group) => (
              <NavDropdown key={group.title} group={group} pathname={pathname} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const isActive = isGroupActive(group, pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap outline-none transition-all",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        {group.title}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {group.items.map((item) => (
          <NavMenuItem key={item.href} item={item} pathname={pathname} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isItemActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <DropdownMenuItem asChild>
      <Link
        href={item.href}
        className={cn(
          "flex cursor-pointer items-center gap-2",
          isActive && "font-medium text-primary"
        )}
      >
        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
        {item.name}
      </Link>
    </DropdownMenuItem>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isItemActive(item.href, pathname);

  return (
    <Link
      href={item.href}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {item.name}
    </Link>
  );
}

function isGroupActive(group: NavGroup, pathname: string) {
  const roots = GROUP_ROOTS[group.title] ?? [];
  return [...roots, ...group.items.map((item) => item.href)].some((href) => isItemActive(href, pathname));
}

function isItemActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
