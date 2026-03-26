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
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-5">
        <Button variant="ghost" size="icon" className="lg:hidden -ml-1" onClick={() => setMobileMenuOpen(true)}>
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

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSearchOpen(true)}>
            <Search className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <NotificationBell />
          {session?.user && (
            <div className="flex items-center gap-2 ml-1">
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 border border-primary/20 text-primary text-xs font-semibold select-none">
                  {initials}
                </div>
                <span className="text-sm text-muted-foreground max-w-[140px] truncate hidden md:block">
                  {session.user.name || session.user.email}
                </span>
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
