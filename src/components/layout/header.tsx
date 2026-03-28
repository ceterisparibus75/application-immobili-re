"use client";

import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Search } from "lucide-react";
import { useState } from "react";
import { MobileSidebar } from "./mobile-sidebar";
import { useSociety } from "@/providers/society-provider";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notifications/notification-bell";

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function Header() {
  const { data: session } = useSession();
  const { activeSociety } = useSociety();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const displayName = session?.user?.name || session?.user?.email || "";
  const initials = displayName ? getInitials(displayName) : "?";

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-6">
        <Button variant="ghost" size="icon" className="lg:hidden -ml-2" onClick={() => setMobileMenuOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>

        {activeSociety && (
          <div className="flex-1 lg:hidden">
            <p className="text-sm font-semibold truncate">{activeSociety.name}</p>
          </div>
        )}

        <div className="hidden lg:flex flex-1 items-center">
          <GlobalSearch />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSearchOpen(true)}>
            <Search className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <NotificationBell />

          {session?.user && (
            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border/40">
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-white text-[11px] font-bold select-none shadow-sm">
                  {initials}
                </div>
                <div className="hidden md:block">
                  <p className="text-[13px] font-medium leading-tight">{session.user.name || session.user.email}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Gestionnaire</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Deconnexion"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <MobileSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {mobileSearchOpen && (
        <div className="lg:hidden">
          <GlobalSearch />
        </div>
      )}
    </>
  );
}
