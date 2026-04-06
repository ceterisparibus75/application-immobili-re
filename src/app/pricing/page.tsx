import { Building2, Check, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Offres | ${APP_NAME}`,
  description: "Tarification adaptée à votre structure patrimoniale. Chaque déploiement fait l\u2019objet d\u2019un audit préalable.",
};

const plans = [
  {
    name: "Fondation",
    description: "Structure patrimoniale jusqu\u2019à 20 actifs",
    priceLabel: "Sur audit",
    limits: "20 lots \u00b7 1 entité \u00b7 2 utilisateurs",
    features: [
      "Gestion de patrimoine complète",
      "Baux et locataires",
      "Facturation et quittances PDF",
      "Tableau de bord analytique",
      "Support par email",
    ],
    cta: "Demander une démonstration",
    highlighted: false,
  },
  {
    name: "Pilotage",
    description: "Multi-sociétés avec comptabilité intégrée",
    priceLabel: "Sur audit",
    limits: "50 lots \u00b7 3 entités \u00b7 5 utilisateurs",
    features: [
      "Tout Fondation +",
      "Comptabilité complète & export FEC",
      "Connexion bancaire automatique",
      "Relances automatiques",
      "Portail locataire sécurisé",
      "Support prioritaire",
    ],
    cta: "Demander une démonstration",
    highlighted: true,
  },
  {
    name: "Infrastructure",
    description: "Portefeuilles sans limites, SLA dédié",
    priceLabel: "Sur mesure",
    limits: "Actifs et entités illimités",
    features: [
      "Tout Pilotage +",
      "Actifs et entités illimités",
      "Signature électronique",
      "Import IA de documents",
      "Accès API",
      "Support dédié & SLA 99,9%",
    ],
    cta: "Organiser un échange",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#fonctionnalites" className="text-muted-foreground hover:text-foreground">Plateforme</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/contact">
              <Button size="sm" className="gap-1.5">
                Demander une démonstration <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">Offres</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-5">
            Tarification adaptée à votre structure
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Chaque déploiement fait l&apos;objet d&apos;un audit préalable pour dimensionner l&apos;offre à vos besoins réels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 flex flex-col bg-card transition-all duration-300 ${
                plan.highlighted
                  ? "border-primary shadow-2xl ring-2 ring-primary relative md:-mt-4 md:mb-4"
                  : "border-border hover:shadow-lg hover:border-primary/20"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-lg">
                  Recommandé
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">{plan.priceLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tarification annuelle personnalisée
                </p>
              </div>

              <p className="text-xs font-semibold text-muted-foreground mb-5 pb-5 border-b">
                {plan.limits}
              </p>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/contact" className="block">
                <Button
                  className={`w-full h-12 text-sm font-semibold ${plan.highlighted ? "shadow-lg shadow-primary/25" : ""}`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <h3 className="text-2xl font-bold mb-8">Questions fréquentes</h3>
          <div className="max-w-2xl mx-auto space-y-6 text-sm text-left">
            <div className="border-b pb-5">
              <p className="font-bold text-base">Comment se déroule le déploiement ?</p>
              <p className="text-muted-foreground mt-2">Après un audit de votre structure patrimoniale, nous configurons la plateforme selon votre organisation. L&apos;import de vos données existantes est accompagné.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">La plateforme s&apos;intègre-t-elle à nos outils existants ?</p>
              <p className="text-muted-foreground mt-2">Oui. Connexion bancaire automatique, export FEC pour la comptabilité, API d&apos;accès pour les plans Infrastructure. Import CSV/Excel pour la reprise de données.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">Quel est le niveau de sécurité ?</p>
              <p className="text-muted-foreground mt-2">Chiffrement AES-256-GCM sur les données sensibles, authentification multifactorielle, hébergement en Europe (Frankfurt), audit logs complets et conformité RGPD native.</p>
            </div>
            <div>
              <p className="font-bold text-base">Proposez-vous un accompagnement personnalisé ?</p>
              <p className="text-muted-foreground mt-2">Chaque déploiement est accompagné. Les clients Infrastructure bénéficient d&apos;un onboarding dédié avec un interlocuteur unique.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground flex justify-center gap-4">
          <Link href="/cgu" className="hover:underline">CGU</Link>
          <Link href="/cgv" className="hover:underline">CGV</Link>
          <Link href="/dpa" className="hover:underline">DPA</Link>
          <Link href="/politique-confidentialite" className="hover:underline">Confidentialité</Link>
          <Link href="/mentions-legales" className="hover:underline">Mentions légales</Link>
        </div>
      </main>
    </div>
  );
}
