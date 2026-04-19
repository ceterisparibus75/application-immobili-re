"use client";

import Link from "next/link";
import { ArrowRight, Menu, X, Shield, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { APP_NAME } from "./data";

const NAV_LINKS = [
  { href: "#solutions", label: "Solutions", isAnchor: true },
  { href: "#fonctionnalites", label: "Fonctionnalités", isAnchor: true },
  { href: "#tarifs", label: "Tarifs", isAnchor: true },
  { href: "/securite", label: "Sécurité", isAnchor: false },
  { href: "/contact", label: "Contact", isAnchor: false },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-9" width={140} height={36} />
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {NAV_LINKS.map((link) =>
            link.isAnchor ? (
              <a key={link.href} href={link.href} className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* CTA desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-[var(--color-brand-deep)] font-semibold">
              Se connecter
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg">
              Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Bouton hamburger mobile */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="flex flex-col h-full">
              {/* Header du menu mobile */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-8" width={124} height={32} />
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" aria-label="Fermer le menu">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>

              {/* Liens de navigation */}
              <nav className="flex-1 px-4 py-6 space-y-1">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    {link.isAnchor ? (
                      <a href={link.href} className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </SheetClose>
                ))}

                <div className="pt-4 border-t mt-4">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    Hébergement UE · RGPD · AES-256
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    contact@mygestia.immo
                  </div>
                </div>
              </nav>

              {/* CTA mobile */}
              <div className="px-4 py-6 border-t space-y-3">
                <SheetClose asChild>
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full h-11 rounded-xl font-semibold">
                      Se connecter
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/signup" className="block">
                    <Button className="w-full h-11 rounded-xl font-semibold gap-2 bg-brand-gradient-soft hover:opacity-90 text-white">
                      Essai gratuit — 14 jours sans CB <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
