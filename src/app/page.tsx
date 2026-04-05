import { Building2, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

export const metadata: Metadata = {
  title: `${APP_NAME} — Gestion immobiliere SaaS`,
  description: "Plateforme SaaS de gestion locative : patrimoine, baux, locataires, facturation, comptabilite. Essai gratuit 14 jours.",
  openGraph: {
    title: `${APP_NAME} — Gestion immobiliere SaaS`,
    description: "Gerez votre patrimoine immobilier en toute simplicite. Baux, locataires, facturation, comptabilite.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">GestImmo</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/locaux"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Locaux disponibles
            </Link>
            <Link
              href="/contact"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Espace gestion
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Locaux commerciaux{" "}
            <span className="text-primary">disponibles</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Découvrez notre sélection de locaux commerciaux, bureaux et
            entrepôts à louer. Des espaces adaptés à votre activité.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/locaux">
              <Button size="lg">Voir les locaux disponibles</Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Caractéristiques */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Building2}
              title="Locaux de qualité"
              description="Des espaces commerciaux entretenus et conformes aux normes en vigueur."
            />
            <FeatureCard
              icon={MapPin}
              title="Emplacements stratégiques"
              description="Des locaux situés dans des zones à fort potentiel commercial."
            />
            <FeatureCard
              icon={Phone}
              title="Accompagnement personnalisé"
              description="Une équipe disponible pour vous accompagner dans votre recherche."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-bold">GestImmo</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Gestion de patrimoine immobilier commercial
              </p>
            </div>
            <div className="flex gap-8 text-sm">
              <div>
                <p className="font-medium mb-2">Navigation</p>
                <div className="space-y-1 text-muted-foreground">
                  <Link href="/locaux" className="block hover:text-foreground">
                    Locaux disponibles
                  </Link>
                  <Link
                    href="/contact"
                    className="block hover:text-foreground"
                  >
                    Contact
                  </Link>
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">Légal</p>
                <div className="space-y-1 text-muted-foreground">
                  <Link
                    href="/mentions-legales"
                    className="block hover:text-foreground"
                  >
                    Mentions légales
                  </Link>
                  <Link
                    href="/politique-confidentialite"
                    className="block hover:text-foreground"
                  >
                    Confidentialité
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex rounded-lg bg-primary/10 p-3 mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
