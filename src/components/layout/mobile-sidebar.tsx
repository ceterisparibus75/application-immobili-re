"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, LayoutDashboard, FileText, Users, Receipt,
  TrendingUp, Landmark, BookOpen, Contact,
  Settings, Shield, ScrollText, Layers, X, FolderOpen,
  Upload, Banknote, BarChart3, FileBarChart, Merge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SocietySwitcher } from "./society-switcher";

const navigation = [
  { title: "Général", items: [{ name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard }] },
  { title: "Patrimoine", items: [
    { name: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
    { name: "Lots", href: "/patrimoine/lots", icon: Layers },
  ]},
  { title: "Gestion locative", items: [
    { name: "Baux", href: "/baux", icon: FileText },
    { name: "Locataires", href: "/locataires", icon: Users },
    { name: "Facturation", href: "/facturation", icon: Receipt },
    { name: "Charges", href: "/charges", icon: ScrollText },
    { name: "Révisions / Indices", href: "/indices", icon: TrendingUp },
    { name: "Documents", href: "/documents", icon: FolderOpen },
    { name: "Import bail PDF", href: "/import", icon: Upload },
  ]},
  { title: "Finances", items: [
    { name: "Banque", href: "/banque", icon: Landmark },
    { name: "Emprunts", href: "/emprunts", icon: Banknote },
    { name: "Comptabilité", href: "/comptabilite", icon: BookOpen },
    { name: "Prévisionnel", href: "/comptabilite/previsionnel", icon: BarChart3 },
    { name: "Rapports", href: "/rapports", icon: FileBarChart },
  ]},
  { title: "Communication", items: [
    { name: "Contacts", href: "/contacts", icon: Contact },
  ]},
  { title: "Conformité", items: [{ name: "RGPD", href: "/rgpd", icon: Shield }] },
  { title: "Administration", items: [
    { name: "Utilisateurs", href: "/administration/utilisateurs", icon: Shield },
    { name: "Fusions", href: "/administration/fusions", icon: Merge },
    { name: "Audit", href: "/administration/audit", icon: ScrollText },
    { name: "Paramètres", href: "/parametres", icon: Settings },
  ]},
];

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-72 flex flex-col bg-sidebar border-r border-sidebar-border animate-slide-in-left">
        <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mygestia.svg" alt="MyGestia" className="h-7" />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-3 py-3 border-b border-sidebar-border">
          <SocietySwitcher />
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navigation.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && "mt-4")}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted/60 select-none">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-sidebar-muted/50 group-hover:text-sidebar-muted"
                      )} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
