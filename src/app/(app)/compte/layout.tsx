"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Users, CreditCard, ScrollText, ShieldCheck } from "lucide-react";

const TABS = [
  { href: "/compte", label: "Mon profil", icon: User },
  { href: "/compte/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/compte/logs", label: "Logs", icon: ScrollText },
  { href: "/compte/rgpd", label: "RGPD", icon: ShieldCheck },
  { href: "/compte/abonnement", label: "Abonnement", icon: CreditCard },
];

export default function CompteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez votre profil, vos utilisateurs et votre abonnement
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const isActive = tab.href === "/compte"
            ? pathname === "/compte"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
