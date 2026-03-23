"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
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
  Upload,
  Merge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SocietySwitcher } from "./society-switcher";

const navigation = [
  {
    title: "Général",
    items: [
      { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Patrimoine",
    items: [
      { name: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
      { name: "Lots", href: "/patrimoine/lots", icon: Building2 },
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
      { name: "Comptabilité", href: "/comptabilite", icon: BookOpen },
      { name: "Prévisionnel", href: "/comptabilite/previsionnel", icon: BarChart3 },
    ],
  },
  {
    title: "Communication",
    items: [
      { name: "Relances", href: "/relances", icon: Bell },
      { name: "Contacts", href: "/contacts", icon: Contact },
    ],
  },
  {
    title: "Conformité",
    items: [
      { name: "RGPD", href: "/rgpd", icon: Shield },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Sociétés", href: "/societes", icon: Building2 },
      { name: "Utilisateurs", href: "/administration/utilisateurs", icon: Shield },
      { name: "Fusions", href: "/administration/fusions", icon: Merge },
      { name: "Audit", href: "/administration/audit", icon: ScrollText },
      { name: "Paramètres", href: "/parametres", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-border">
      {/* Logo + sélecteur de société */}
      <div className="border-b border-border px-3 py-3 space-y-1">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent transition-colors">
          <Building2 className="h-5 w-5 text-primary shrink-0" />
          <span className="font-bold text-base text-sidebar-foreground">GestImmo</span>
        </Link>
        <SocietySwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navigation.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
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
