import {
  Building2,
  BarChart3,
  FileText,
  Users,
  Shield,
  CreditCard,
  Banknote,
  ArrowRight,
  Check,
  Star,
  Zap,
  Clock,
  Lock,
  Globe,
  ChevronRight,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata: Metadata = {
  title: `${APP_NAME} — La gestion immobiliere intelligente`,
  description:
    "Simplifiez la gestion de votre patrimoine immobilier. Baux, locataires, facturation, comptabilite, banque — tout en un seul outil. Essai gratuit 14 jours.",
  openGraph: {
    title: `${APP_NAME} — La gestion immobiliere intelligente`,
    description:
      "Simplifiez la gestion de votre patrimoine immobilier. Baux, locataires, facturation, comptabilite, banque — tout en un seul outil.",
    type: "website",
  },
};

/* ─── Data ─────────────────────────────────────────────────────────────── */

const stats = [
  { value: "2 min", label: "pour generer une facture" },
  { value: "100%", label: "conforme RGPD" },
  { value: "99,9%", label: "de disponibilite" },
  { value: "14 j", label: "d'essai gratuit" },
];

const features = [
  {
    icon: Building2,
    title: "Patrimoine",
    description:
      "Gerez vos immeubles, lots, diagnostics et maintenances depuis un tableau de bord centralise.",
  },
  {
    icon: FileText,
    title: "Baux & Facturation",
    description:
      "Creez vos baux, generez factures et quittances en PDF, suivez les echeances automatiquement.",
  },
  {
    icon: Users,
    title: "Locataires",
    description:
      "Fiches locataires completes, portail dedie, documents partages et communication simplifiee.",
  },
  {
    icon: Banknote,
    title: "Connexion bancaire",
    description:
      "Synchronisez vos comptes bancaires et rapprochez automatiquement les paiements recus.",
  },
  {
    icon: BarChart3,
    title: "Comptabilite",
    description:
      "Plan comptable immobilier, export FEC, suivi des charges, regularisations et previsionnel.",
  },
  {
    icon: Shield,
    title: "Conformite & Securite",
    description:
      "Chiffrement AES-256, 2FA, audit logs, RGPD integre. Hebergement europeen certifie.",
  },
];

const steps = [
  {
    step: "1",
    title: "Creez votre compte",
    description: "Inscription en 30 secondes. Aucune carte bancaire requise pour l'essai gratuit de 14 jours.",
  },
  {
    step: "2",
    title: "Configurez votre patrimoine",
    description: "Ajoutez vos immeubles, lots et locataires. Importez vos donnees existantes en un clic.",
  },
  {
    step: "3",
    title: "Gerez tout au meme endroit",
    description: "Factures, paiements, relances, comptabilite — tout est automatise et centralise.",
  },
];

const testimonials = [
  {
    name: "Sophie L.",
    role: "Gestionnaire, 45 lots",
    text: "Depuis MyGestia, je gagne 2 heures par semaine sur la facturation. Les relances automatiques ont reduit mes impayes de 40%.",
    rating: 5,
  },
  {
    name: "Thomas R.",
    role: "SCI familiale, 12 lots",
    text: "Interface claire, prise en main immediate. La connexion bancaire et le rapprochement automatique, c'est un game-changer.",
    rating: 5,
  },
  {
    name: "Marie D.",
    role: "Cabinet de gestion, 200+ lots",
    text: "On a remplace 3 outils par MyGestia. L'export FEC pour notre comptable fonctionne parfaitement. Support tres reactif.",
    rating: 5,
  },
];

const plans = [
  {
    name: "Starter",
    description: "Pour les petits patrimoines",
    price: 29,
    priceYearly: 290,
    limits: "10 lots · 1 societe · 2 utilisateurs",
    features: [
      "Gestion de patrimoine",
      "Baux et locataires",
      "Facturation et quittances PDF",
      "Tableau de bord",
      "Support par email",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    description: "Pour les professionnels",
    price: 79,
    priceYearly: 790,
    limits: "50 lots · 3 societes · 5 utilisateurs",
    features: [
      "Tout Starter +",
      "Comptabilite complete & export FEC",
      "Connexion bancaire",
      "Relances automatiques",
      "Portail locataire",
      "Support prioritaire",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "Pour les grands portefeuilles",
    price: 199,
    priceYearly: 1990,
    limits: "Lots et societes illimites",
    features: [
      "Tout Pro +",
      "Lots et societes illimites",
      "Signature electronique",
      "Import IA de documents",
      "Acces API",
      "Support dedie & SLA 99,9%",
    ],
    highlighted: false,
  },
];

const faqs = [
  {
    q: "L'essai gratuit est-il vraiment sans engagement ?",
    a: "Oui. 14 jours d'acces complet, sans carte bancaire. Vous pouvez annuler a tout moment.",
  },
  {
    q: "Puis-je importer mes donnees existantes ?",
    a: "Oui. MyGestia supporte l'import CSV et Excel pour vos immeubles, lots, locataires et baux.",
  },
  {
    q: "Mes donnees sont-elles en securite ?",
    a: "Absolument. Chiffrement AES-256, authentification 2FA, hebergement en Europe (Frankfurt), audit logs complets et conformite RGPD.",
  },
  {
    q: "Puis-je changer d'offre a tout moment ?",
    a: "Oui. Les upgrades sont immediats avec prorata. Les downgrades prennent effet a la fin de la periode en cours.",
  },
  {
    q: "Proposez-vous un accompagnement a la mise en place ?",
    a: "Les clients Enterprise beneficient d'un onboarding personnalise. Pour les autres plans, notre centre d'aide et notre support email sont la pour vous guider.",
  },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">{APP_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#fonctionnalites" className="text-muted-foreground hover:text-foreground transition-colors">
              Fonctionnalites
            </a>
            <a href="#tarifs" className="text-muted-foreground hover:text-foreground transition-colors">
              Tarifs
            </a>
            <a href="#temoignages" className="text-muted-foreground hover:text-foreground transition-colors">
              Temoignages
            </a>
            <Link href="/aide" className="text-muted-foreground hover:text-foreground transition-colors">
              Aide
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Se connecter
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="gap-1.5">
                Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <Sparkles className="h-4 w-4" />
              Essai gratuit 14 jours — sans carte bancaire
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              La gestion immobiliere{" "}
              <span className="text-primary">enfin simple</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Patrimoine, baux, locataires, facturation, comptabilite, banque — centralisez toute votre gestion locative dans un seul outil moderne et securise.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 h-12 gap-2">
                  Demarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#fonctionnalites">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-12">
                  Decouvrir les fonctionnalites
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof Banner ─── */}
      <section className="border-y bg-muted/30 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-primary" /> Conforme RGPD
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-primary" /> Chiffrement AES-256
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" /> Heberge en Europe
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" /> Support reactif
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Uptime 99,9%
            </span>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="fonctionnalites" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une plateforme complete pour gerer votre patrimoine immobilier de A a Z.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Pret en 3 etapes
            </h2>
            <p className="text-lg text-muted-foreground">
              Commencez a gerer votre patrimoine en moins de 5 minutes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-primary/20" />
                )}
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold mb-5">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="tarifs" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Des tarifs simples et transparents
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              14 jours d&apos;essai gratuit sur toutes les offres. Sans engagement, sans carte bancaire.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 flex flex-col transition-shadow duration-300 ${
                  plan.highlighted
                    ? "border-primary shadow-xl ring-1 ring-primary relative scale-[1.02]"
                    : "border-border hover:shadow-lg"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                    Le plus populaire
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}&euro;</span>
                    <span className="text-muted-foreground">/mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ou {plan.priceYearly}&euro;/an (
                    {Math.round(
                      (1 - plan.priceYearly / (plan.price * 12)) * 100
                    )}
                    % d&apos;economie)
                  </p>
                </div>

                <p className="text-xs font-medium text-muted-foreground mb-4 pb-4 border-b">
                  {plan.limits}
                </p>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/login" className="block">
                  <Button
                    className="w-full h-11"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.name === "Enterprise"
                      ? "Contacter l'equipe"
                      : "Demarrer l'essai gratuit"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="temoignages" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ils nous font confiance
            </h2>
            <p className="text-lg text-muted-foreground">
              Des gestionnaires comme vous qui ont simplifie leur quotidien.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border bg-card p-8"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6 text-muted-foreground">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Questions frequentes
            </h2>
          </div>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b pb-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Pret a simplifier votre gestion ?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Rejoignez les gestionnaires qui gagnent du temps chaque jour avec MyGestia. Essai gratuit, sans engagement.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/login">
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto text-base px-8 h-12 gap-2"
              >
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base px-8 h-12 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Contacter l&apos;equipe
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Building2 className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="font-bold text-lg">{APP_NAME}</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                La plateforme SaaS de gestion immobiliere pour les professionnels et les SCI.
              </p>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Produit</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <a href="#fonctionnalites" className="block hover:text-foreground transition-colors">
                  Fonctionnalites
                </a>
                <a href="#tarifs" className="block hover:text-foreground transition-colors">
                  Tarifs
                </a>
                <Link href="/aide" className="block hover:text-foreground transition-colors">
                  Centre d&apos;aide
                </Link>
                <Link href="/contact" className="block hover:text-foreground transition-colors">
                  Contact
                </Link>
              </div>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Legal</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <Link href="/cgu" className="block hover:text-foreground transition-colors">
                  CGU
                </Link>
                <Link href="/cgv" className="block hover:text-foreground transition-colors">
                  CGV
                </Link>
                <Link href="/mentions-legales" className="block hover:text-foreground transition-colors">
                  Mentions legales
                </Link>
                <Link href="/politique-confidentialite" className="block hover:text-foreground transition-colors">
                  Confidentialite
                </Link>
                <Link href="/dpa" className="block hover:text-foreground transition-colors">
                  DPA
                </Link>
              </div>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Securite</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Chiffrement AES-256
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Conforme RGPD
                </p>
                <p className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Heberge en Europe
                </p>
                <p className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Paiement securise Stripe
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} {APP_NAME}. Tous droits reserves.</p>
            <p>
              Fait avec soin en France
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
