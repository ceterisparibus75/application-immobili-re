import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "./data";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-9" width={140} height={36} />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="#solutions" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
            Solutions
          </a>
          <a href="#fonctionnalites" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
            Fonctionnalités
          </a>
          <a href="#tarifs" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
            Tarifs
          </a>
          <Link href="/securite" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
            Sécurité
          </Link>
          <Link href="/contact" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-3">
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
      </div>
    </header>
  );
}
