"use client";

import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User, Search } from "lucide-react";
import { useState } from "react";
import { MobileSidebar } from "./mobile-sidebar";
import { useSociety } from "@/providers/society-provider";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Header() {
  const { data: session } = useSession();
  const { activeSociety } = useSociety();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}>
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
            <div className="flex items-center gap-1">
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground px-2">
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[160px] truncate">{session.user.name || session.user.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })} title="Deconnexion">
                <LogOut className="h-4 w-4" />
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
