import { Building2, Check, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata = {
  title: `Tarifs | ${APP_NAME}`,
  description: "Découvrez nos offres de gestion immobilière SaaS. 14 jours d'essai gratuit.",
};

const plans = [
  {
    name: "Starter",
    description: "Pour les petits patrimoines",
    price: { monthly: 19, yearly: 190 },
    limits: "20 lots · 1 société · 2 utilisateurs",
    features: [
      "Gestion de patrimoine",
      "Baux et locataires",
      "Facturation et quittances PDF",
      "Tableau de bord analytique",
      "Support par email",
    ],
    cta: "Démarrer l\u2019essai gratuit",
    highlighted: false,
  },
  {
    name: "Pro",
    description: "Pour les gestionnaires professionnels",
    price: { monthly: 79, yearly: 790 },
    limits: "50 lots · 3 sociétés · 5 utilisateurs",
    features: [
      "Tout Starter +",
      "Comptabilité complète & export FEC",
      "Connexion bancaire automatique",
      "Relances automatiques",
      "Portail locataire",
      "Support prioritaire",
    ],
    cta: "Démarrer l\u2019essai gratuit",
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Pour les grands portefeuilles",
    price: { monthly: 199, yearly: 1990 },
    limits: "Lots et sociétés illimités",
    features: [
      "Tout Pro +",
      "Lots et sociétés illimités",
      "Signature électronique",
      "Import IA de documents",
      "Accès API",
      "Support dédié & SLA 99,9%",
    ],
    cta: "Contacter l\u2019équipe commerciale",
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
            <Link href="/#fonctionnalites" className="text-muted-foreground hover:text-foreground">Fonctionnalités</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">Tarifs</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-5">
            Des tarifs simples et transparents
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            14 jours d&apos;essai gratuit sur toutes les offres. Sans engagement, sans carte bancaire.
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
                  Le plus populaire
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold">{plan.price.monthly}</span>
                  <span className="text-xl font-semibold text-muted-foreground">&euro;/mois</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ou {plan.price.yearly}&euro;/an{" "}
                  <span className="text-primary font-semibold">
                    (-{Math.round((1 - plan.price.yearly / (plan.price.monthly * 12)) * 100)}%)
                  </span>
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

              <Link href={plan.name === "Enterprise" ? "/contact" : `/signup?plan=${plan.name.toLowerCase()}`} className="block">
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
              <p className="font-bold text-base">Puis-je changer d&apos;offre à tout moment ?</p>
              <p className="text-muted-foreground mt-2">Oui. Les upgrades sont immédiats avec un prorata. Les downgrades prennent effet à la fin de la période en cours.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">L&apos;essai gratuit est-il vraiment sans engagement ?</p>
              <p className="text-muted-foreground mt-2">Oui. Aucune carte bancaire n&apos;est requise pour commencer. Vous pouvez annuler à tout moment pendant les 14 jours d&apos;essai.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">Mes données sont-elles en sécurité ?</p>
              <p className="text-muted-foreground mt-2">Absolument. Chiffrement AES-256 pour les données sensibles, hébergement en Europe (Frankfurt), audit logs complets et conformité RGPD.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">Que se passe-t-il si je dépasse les limites de mon plan ?</p>
              <p className="text-muted-foreground mt-2">Vous serez invité à passer au plan supérieur. Vos données existantes ne seront jamais supprimées.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">Que comprend l&apos;essai gratuit ?</p>
              <p className="text-muted-foreground mt-2">Pendant 14 jours, vous accédez à toutes les fonctionnalités de votre plan sans restriction. Aucune carte bancaire n&apos;est requise. À la fin de l&apos;essai, choisissez de vous abonner ou vos données seront conservées 30 jours.</p>
            </div>
            <div className="border-b pb-5">
              <p className="font-bold text-base">Quelles fonctionnalités sont réservées au plan Enterprise ?</p>
              <p className="text-muted-foreground mt-2">Le plan Enterprise inclut : lots et sociétés illimités, signature électronique intégrée, import IA de documents (Excel, CSV), accès API, et un support dédié avec SLA 99,9%.</p>
            </div>
            <div>
              <p className="font-bold text-base">Puis-je importer mes données existantes ?</p>
              <p className="text-muted-foreground mt-2">Oui. Vous pouvez importer vos immeubles, lots, locataires et baux depuis des fichiers Excel ou CSV. Le plan Enterprise propose un import assisté par intelligence artificielle qui détecte et mappe automatiquement vos données.</p>
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
