"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Crown,
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  TrendingUp,
  Landmark,
  BookOpen,
  Bell,
  Contact,
  FolderOpen,
  Settings,
  Shield,
  ScrollText,
  Banknote,
  BarChart3,
  FileBarChart,
  BellDot,
  Upload,
  Merge,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SocietySwitcher } from "./society-switcher";

const navigation = [
  {
    title: "Proprietaire",
    items: [{ name: "Vue proprietaire", href: "/proprietaire", icon: Crown }],
  },
  {
    title: "General",
    items: [{ name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Patrimoine",
    items: [
      { name: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
      { name: "Lots", href: "/patrimoine/lots", icon: Layers },
    ],
  },
  {
    title: "Gestion locative",
    items: [
      { name: "Baux", href: "/baux", icon: FileText },
      { name: "Locataires", href: "/locataires", icon: Users },
      { name: "Documents", href: "/documents", icon: FolderOpen },
      { name: "Import bail PDF", href: "/import", icon: Upload },
    ],
  },
  {
    title: "Finances",
    items: [
      { name: "Facturation", href: "/facturation", icon: Receipt },
      { name: "Charges", href: "/charges", icon: ScrollText },
      { name: "Indices", href: "/indices", icon: TrendingUp },
      { name: "Banque", href: "/banque", icon: Landmark },
      { name: "Emprunts", href: "/emprunts", icon: Banknote },
      { name: "Comptabilite", href: "/comptabilite", icon: BookOpen },
      { name: "Previsionnel", href: "/comptabilite/previsionnel", icon: BarChart3 },
      { name: "Rapports", href: "/rapports", icon: FileBarChart },
    ],
  },
  {
    title: "Communication",
    items: [
      { name: "Relances", href: "/relances", icon: Bell },
      { name: "Notifications", href: "/notifications", icon: BellDot },
      { name: "Contacts", href: "/contacts", icon: Contact },
    ],
  },
  {
    title: "Conformite",
    items: [{ name: "RGPD", href: "/rgpd", icon: Shield }],
  },
  {
    title: "Administration",
    items: [
      { name: "Societes", href: "/societes", icon: Building2 },
      { name: "Utilisateurs", href: "/administration/utilisateurs", icon: Shield },
      { name: "Fusions", href: "/administration/fusions", icon: Merge },
      { name: "Audit", href: "/administration/audit", icon: ScrollText },
      { name: "Parametres", href: "/parametres", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 border-r border-border/60"
      style={{
        background: "oklch(0.988 0.001 264 / 0.75)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border/50">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <Link href="/dashboard" className="font-semibold text-sm text-foreground tracking-tight">
          GestImmo
        </Link>
      </div>

      {/* Selecteur de societe */}
      <div className="px-2 py-2 border-b border-border/50">
        <SocietySwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navigation.map((group) => (
          <div key={group.title} className="mb-3">
            <p className="px-3 mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground select-none">
              {group.title}
            </p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-100",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-foreground/35 group-hover:text-foreground/55"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
