"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Receipt, ScrollText, Mail, Bell, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "Facturation", href: "/facturation", icon: Receipt },
  { name: "Charges", href: "/charges", icon: ScrollText },
  { name: "Courriers", href: "/courriers", icon: Mail },
  { name: "Relances", href: "/facturation?tab=relances", icon: Bell },
  { name: "Révisions / Indices", href: "/indices", icon: TrendingUp },
] as const;

export function GestionLocativeNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  return (
    <div className="border-b border-border/60 mb-6">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
        {TABS.map((tab) => {
          let isActive = false;

          if (tab.name === "Relances") {
            // Actif quand on est sur /facturation?tab=relances ou /facturation?tab=en-retard
            isActive = pathname === "/facturation" && (currentTab === "relances" || currentTab === "en-retard");
          } else if (tab.name === "Facturation") {
            // Actif sur /facturation sans tab relances/en-retard, ou sur sous-pages
            isActive = (pathname === "/facturation" && currentTab !== "relances" && currentTab !== "en-retard")
              || (pathname.startsWith("/facturation/") && true);
          } else {
            isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
