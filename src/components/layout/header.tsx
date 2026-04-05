"use client";

import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Search, User, Users, CreditCard, ChevronDown, Building2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { MobileSidebar } from "./mobile-sidebar";
import { useSociety } from "@/providers/society-provider";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notifications/notification-bell";
import Link from "next/link";

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function Header() {
  const { data: session } = useSession();
  const { activeSociety } = useSociety();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = session?.user?.name || session?.user?.email || "";
  const initials = displayName ? getInitials(displayName) : "?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            <div className="relative ml-2 pl-3 border-l border-border/40" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-white text-[11px] font-bold select-none shadow-sm">
                  {initials}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-[13px] font-medium leading-tight">{session.user.name || session.user.email}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Gestionnaire</p>
                </div>
                <ChevronDown className={`h-3 w-3 text-muted-foreground hidden md:block transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card text-card-foreground shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium truncate">{session.user.name || session.user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/proprietaire"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Vue propriétaire
                    </Link>
                    <Link
                      href="/compte"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      Mon profil
                    </Link>
                    <Link
                      href="/compte/utilisateurs"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Utilisateurs
                    </Link>
                    <Link
                      href="/compte/abonnement"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Abonnement
                    </Link>
                  </div>
                  <div className="p-1.5 border-t">
                    <button
                      onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/login" }); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
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
