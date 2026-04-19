import Link from "next/link";
import { Shield, Lock, Globe } from "lucide-react";
import { APP_NAME } from "./data";

const TRUST_BADGES = [
  { icon: Shield, label: "Conforme RGPD" },
  { icon: Globe, label: "Hébergement UE" },
  { icon: Lock, label: "Chiffrement AES-256" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Grille principale */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Logo + description + badges */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-8" width={124} height={32} />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
              Plateforme sécurisée de gestion d&apos;actifs immobiliers pour les foncières, les cabinets de gestion et les family offices.
            </p>
            {/* Badges de confiance */}
            <div className="flex flex-col gap-2">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Produit */}
          <div>
            <p className="font-semibold text-sm mb-4">Produit</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <a href="#fonctionnalites" className="block hover:text-foreground transition-colors">
                Fonctionnalités
              </a>
              <a href="#tarifs" className="block hover:text-foreground transition-colors">
                Tarifs
              </a>
              <Link href="/securite" className="block hover:text-foreground transition-colors">
                Sécurité
              </Link>
              <Link href="/pricing" className="block hover:text-foreground transition-colors">
                Comparatif
              </Link>
              <Link href="/contact" className="block hover:text-foreground transition-colors">
                Démonstration
              </Link>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <p className="font-semibold text-sm mb-4">Solutions</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <a href="#solutions" className="block hover:text-foreground transition-colors">
                Foncières & Family Offices
              </a>
              <a href="#solutions" className="block hover:text-foreground transition-colors">
                Cabinets de gestion
              </a>
              <a href="#solutions" className="block hover:text-foreground transition-colors">
                SCI familiales
              </a>
              <Link href="/locaux" className="block hover:text-foreground transition-colors">
                Locaux disponibles
              </Link>
            </div>
          </div>

          {/* Ressources */}
          <div>
            <p className="font-semibold text-sm mb-4">Ressources</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <Link href="/blog" className="block hover:text-foreground transition-colors">
                Blog
              </Link>
              <Link href="/contact" className="block hover:text-foreground transition-colors">
                Contact
              </Link>
              <Link href="/aide" className="block hover:text-foreground transition-colors">
                Documentation
              </Link>
            </div>
          </div>

          {/* Légal */}
          <div>
            <p className="font-semibold text-sm mb-4">Légal</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <Link href="/mentions-legales" className="block hover:text-foreground transition-colors">
                Mentions légales
              </Link>
              <Link href="/cgu" className="block hover:text-foreground transition-colors">
                CGU
              </Link>
              <Link href="/politique-confidentialite" className="block hover:text-foreground transition-colors">
                Politique de confidentialité
              </Link>
              <Link href="/dpa" className="block hover:text-foreground transition-colors">
                DPA / RGPD
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t flex justify-center items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MTG HOLDING — {APP_NAME}. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
