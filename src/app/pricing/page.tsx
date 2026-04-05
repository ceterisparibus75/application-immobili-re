import { Building2, Check } from "lucide-react";
import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GestImmo";

export const metadata = {
  title: `Tarifs | ${APP_NAME}`,
  description: "Decouvrez nos offres de gestion immobiliere SaaS",
};

const plans = [
  {
    name: "Starter",
    description: "Pour les petits patrimoines",
    price: { monthly: 29, yearly: 290 },
    limits: "10 lots · 1 societe · 2 utilisateurs",
    features: [
      "Gestion de patrimoine",
      "Baux et locataires",
      "Facturation et quittances",
      "Tableau de bord",
      "Support par email",
    ],
    cta: "Commencer l'essai gratuit",
    highlighted: false,
  },
  {
    name: "Pro",
    description: "Pour les gestionnaires professionnels",
    price: { monthly: 79, yearly: 790 },
    limits: "50 lots · 3 societes · 5 utilisateurs",
    features: [
      "Tout Starter +",
      "Comptabilite complete",
      "Connexion bancaire",
      "Relances automatiques",
      "Export FEC",
      "Portail locataire",
      "Support prioritaire",
    ],
    cta: "Commencer l'essai gratuit",
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Pour les grands portefeuilles",
    price: { monthly: 199, yearly: 1990 },
    limits: "Lots et societes illimites",
    features: [
      "Tout Pro +",
      "Lots et societes illimites",
      "Signature electronique",
      "Import IA de documents",
      "Support dedie",
      "Acces API",
      "SLA 99,9%",
    ],
    cta: "Contacter l'equipe commerciale",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/locaux" className="text-muted-foreground hover:text-foreground">Locaux disponibles</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link
              href="/login"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              Se connecter
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Des tarifs simples et transparents
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            14 jours d&apos;essai gratuit sur toutes les offres. Sans engagement, sans carte bancaire.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 flex flex-col ${
                plan.highlighted
                  ? "border-primary shadow-lg ring-1 ring-primary relative"
                  : "border-border"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Le plus populaire
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price.monthly}&euro;</span>
                  <span className="text-muted-foreground">/mois</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ou {plan.price.yearly}&euro;/an (economisez {Math.round((1 - plan.price.yearly / (plan.price.monthly * 12)) * 100)}%)
                </p>
              </div>

              <p className="text-xs font-medium text-muted-foreground mb-4 pb-4 border-b">
                {plan.limits}
              </p>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`w-full text-center py-3 rounded-lg font-medium text-sm transition-colors ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:bg-accent"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-lg font-semibold mb-4">Questions frequentes</h3>
          <div className="max-w-2xl mx-auto space-y-6 text-sm text-left">
            <div>
              <p className="font-medium">Puis-je changer d&apos;offre a tout moment ?</p>
              <p className="text-muted-foreground mt-1">Oui. Les upgrades sont immediats avec un prorata. Les downgrades prennent effet a la fin de la periode en cours.</p>
            </div>
            <div>
              <p className="font-medium">L&apos;essai gratuit est-il vraiment sans engagement ?</p>
              <p className="text-muted-foreground mt-1">Oui. Aucune carte bancaire n&apos;est requise pour commencer. Vous pouvez annuler a tout moment pendant les 14 jours d&apos;essai.</p>
            </div>
            <div>
              <p className="font-medium">Mes donnees sont-elles en securite ?</p>
              <p className="text-muted-foreground mt-1">Absolument. Chiffrement AES-256 pour les donnees sensibles, hebergement en Europe (Supabase Frankfurt), audit logs complets et conformite RGPD.</p>
            </div>
            <div>
              <p className="font-medium">Que se passe-t-il si je depasse les limites de mon plan ?</p>
              <p className="text-muted-foreground mt-1">Vous serez invite a passer au plan superieur. Vos donnees existantes ne seront jamais supprimees.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground flex justify-center gap-4">
          <Link href="/cgu" className="hover:underline">CGU</Link>
          <Link href="/cgv" className="hover:underline">CGV</Link>
          <Link href="/dpa" className="hover:underline">DPA</Link>
          <Link href="/politique-confidentialite" className="hover:underline">Confidentialite</Link>
          <Link href="/mentions-legales" className="hover:underline">Mentions legales</Link>
        </div>
      </main>
    </div>
  );
}
