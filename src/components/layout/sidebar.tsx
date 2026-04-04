"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, Crown, LayoutDashboard, FileText, Users,
  Receipt, TrendingUp, Landmark, BookOpen, Bell, Contact,
  FolderOpen, Settings, Shield, ScrollText, Banknote,
  BarChart3, FileBarChart, BellDot, Upload, Merge,
  Layers, FolderLock,
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
      { name: "Facturation", href: "/facturation", icon: Receipt },
      { name: "Charges", href: "/charges", icon: ScrollText },
      { name: "Revisions / Indices", href: "/indices", icon: TrendingUp },
      { name: "Documents", href: "/documents", icon: FolderOpen },
      { name: "Import bail PDF", href: "/import", icon: Upload },
    ],
  },
  {
    title: "Finances",
    items: [
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
    <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:fixed lg:inset-y-0 bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
          <Building2 className="h-4.5 w-4.5 text-white" />
        </div>
        <Link href="/proprietaire">
          <span className="font-bold text-[15px] text-white tracking-tight">Propriétaire</span>
          <span className="block text-[10px] text-white/40 font-medium -mt-0.5">Vue consolidée</span>
        </Link>
      </div>

      {/* Selecteur societe */}
      <div className="px-3 py-3 border-b border-white/[0.06]">
        <SocietySwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {navigation.map((group, groupIndex) => (
          <div key={group.title} className={cn(groupIndex > 0 && "mt-5")}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 select-none">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-white/[0.1] text-white shadow-sm"
                        : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary shadow-sm shadow-primary/50" />
                    )}
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-150",
                        isActive
                          ? "text-primary-foreground"
                          : "text-white/30 group-hover:text-white/60"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied de sidebar */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-white/20 font-medium">GestImmo v2.0</p>
      </div>
    </aside>
  );
}
