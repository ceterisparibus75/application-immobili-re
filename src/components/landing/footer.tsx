import Link from "next/link";
import { APP_NAME } from "./data";

export function Footer() {
  return (
    <footer className="border-t border-border/60 py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-8" width={124} height={32} />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Plateforme sécurisée de gestion d&apos;actifs immobiliers pour les foncières, les cabinets de gestion et les family offices.
            </p>
          </div>

          <div>
            <p className="font-semibold text-sm mb-4">Solutions</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <a href="#solutions" className="block hover:text-foreground transition-colors">
                Foncières & Family Offices
              </a>
              <a href="#solutions" className="block hover:text-foreground transition-colors">
                Professionnels de la gestion
              </a>
              <a href="#fonctionnalites" className="block hover:text-foreground transition-colors">
                Fonctionnalités
              </a>
              <a href="#tarifs" className="block hover:text-foreground transition-colors">
                Tarifs
              </a>
              <Link href="/contact" className="block hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>

          <div>
            <p className="font-semibold text-sm mb-4">Ressources</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <Link href="/blog" className="block hover:text-foreground transition-colors">
                Blog
              </Link>
              <Link href="/securite" className="block hover:text-foreground transition-colors">
                Sécurité & Conformité
              </Link>
              <Link href="/presse" className="block hover:text-foreground transition-colors">
                Espace Presse
              </Link>
              <Link href="/recrutement" className="block hover:text-foreground transition-colors">
                Recrutement
              </Link>
              <Link href="/aide" className="block hover:text-foreground transition-colors">
                Documentation API
              </Link>
              <Link href="/locaux" className="block hover:text-foreground transition-colors">
                Locaux disponibles
              </Link>
            </div>
          </div>

          <div>
            <p className="font-semibold text-sm mb-4">Juridique</p>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <Link href="/cgu" className="block hover:text-foreground transition-colors">
                CGU
              </Link>
              <Link href="/cgv" className="block hover:text-foreground transition-colors">
                CGV
              </Link>
              <Link href="/mentions-legales" className="block hover:text-foreground transition-colors">
                Mentions légales
              </Link>
              <Link href="/politique-confidentialite" className="block hover:text-foreground transition-colors">
                Confidentialité & RGPD
              </Link>
              <Link href="/dpa" className="block hover:text-foreground transition-colors">
                DPA
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t flex justify-center items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MTG HOLDING · {APP_NAME}. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
