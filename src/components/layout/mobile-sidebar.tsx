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
  Settings,
  Shield,
  ScrollText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SocietySwitcher } from "./society-switcher";

const navItems = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Immeubles", href: "/patrimoine/immeubles", icon: Building2 },
  { name: "Baux", href: "/baux", icon: FileText },
  { name: "Locataires", href: "/locataires", icon: Users },
  { name: "Facturation", href: "/facturation", icon: Receipt },
  { name: "Charges", href: "/charges", icon: ScrollText },
  { name: "Indices", href: "/indices", icon: TrendingUp },
  { name: "Banque", href: "/banque", icon: Landmark },
  { name: "Comptabilité", href: "/comptabilite", icon: BookOpen },
  { name: "Relances", href: "/relances", icon: Bell },
  { name: "Contacts", href: "/contacts", icon: Contact },
  { name: "Sociétés", href: "/societes", icon: Building2 },
  { name: "Utilisateurs", href: "/administration/utilisateurs", icon: Shield },
  { name: "Paramètres", href: "/parametres", icon: Settings },
];

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-72 bg-sidebar border-r border-border">
        <div className="border-b border-border px-3 py-3">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-bold text-base">GestImmo</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SocietySwitcher />
        </div>

        <nav className="overflow-y-auto py-4 px-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
