"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, ScrollText, Mail, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "Facturation", href: "/facturation", icon: Receipt },
  { name: "Charges", href: "/charges", icon: ScrollText },
  { name: "Courriers", href: "/courriers", icon: Mail },
  { name: "Relances", href: "/relances", icon: Bell },
] as const;

export function GestionLocativeNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border/60 mb-6">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href ||
            pathname.startsWith(tab.href + "/");

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
