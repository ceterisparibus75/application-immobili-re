"use client";

import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User } from "lucide-react";
import { useState } from "react";
import { MobileSidebar } from "./mobile-sidebar";
import { useSociety } from "@/providers/society-provider";

export function Header() {
  const { data: session } = useSession();
  const { activeSociety } = useSociety();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        {/* Menu burger mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Société active — visible uniquement sur mobile (la sidebar est cachée) */}
        {activeSociety && (
          <div className="flex-1 lg:hidden">
            <p className="text-sm font-semibold truncate">{activeSociety.name}</p>
          </div>
        )}

        {/* Spacer desktop */}
        <div className="flex-1 hidden lg:block" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {session?.user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[160px] truncate">
                  {session.user.name || session.user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <MobileSidebar
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
}
