import {
  Building2,
  BarChart3,
  FileText,
  Users,
  Shield,
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
  TrendingUp,
  CreditCard,
  BellRing,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata: Metadata = {
  title: `${APP_NAME} — La gestion immobilière intelligente`,
  description:
    "Simplifiez la gestion de votre patrimoine immobilier. Baux, locataires, facturation, comptabilité, banque — tout en un seul outil. Essai gratuit 14 jours.",
  openGraph: {
    title: `${APP_NAME} — La gestion immobilière intelligente`,
    description:
      "Simplifiez la gestion de votre patrimoine immobilier. Baux, locataires, facturation, comptabilité, banque — tout en un seul outil.",
    type: "website",
  },
};

/* ─── Data ─────────────────────────────────────────────────────────────── */

const stats = [
  { value: "2 min", label: "pour générer une facture" },
  { value: "-40%", label: "d\u2019impayés en moyenne" },
  { value: "99,9%", label: "de disponibilité" },
  { value: "14 j", label: "d\u2019essai gratuit" },
];

const features = [
  {
    icon: Building2,
    title: "Patrimoine centralisé",
    description:
      "Immeubles, lots, diagnostics, maintenances — tout votre patrimoine dans un tableau de bord unifié.",
  },
  {
    icon: FileText,
    title: "Baux & facturation automatisés",
    description:
      "Baux, factures, quittances en PDF. Génération automatique, suivi des échéances, zéro oubli.",
  },
  {
    icon: Users,
    title: "Portail locataire dédié",
    description:
      "Vos locataires accèdent à leurs documents, paient en ligne et communiquent avec vous directement.",
  },
  {
    icon: Banknote,
    title: "Connexion bancaire",
    description:
      "Synchronisation automatique de vos comptes. Rapprochement intelligent des paiements en un clic.",
  },
  {
    icon: BarChart3,
    title: "Comptabilité intégrée",
    description:
      "Plan comptable immobilier, export FEC, charges, régularisations et prévisionnel — tout est automatisé.",
  },
  {
    icon: Shield,
    title: "Sécurité maximale",
    description:
      "Chiffrement AES-256, 2FA, audit logs, conformité RGPD native. Hébergement européen certifié.",
  },
];

const highlights = [
  {
    icon: BellRing,
    title: "Relances automatiques",
    description: "3 niveaux de relance programmés. Vos impayés baissent sans effort.",
  },
  {
    icon: TrendingUp,
    title: "Révisions de loyer",
    description: "Indices IRL/ILC/ILAT mis à jour automatiquement depuis l\u2019INSEE.",
  },
  {
    icon: Receipt,
    title: "Export FEC & comptable",
    description: "Fichier des Écritures Comptables conforme, prêt pour votre expert-comptable.",
  },
];

const steps = [
  {
    step: "1",
    title: "Créez votre compte",
    description: "Inscription en 30 secondes. Aucune carte bancaire requise.",
  },
  {
    step: "2",
    title: "Importez votre patrimoine",
    description: "Ajoutez immeubles, lots et locataires. Import CSV/Excel disponible.",
  },
  {
    step: "3",
    title: "Automatisez tout",
    description: "Factures, paiements, relances, comptabilité — tout roule.",
  },
];

const testimonials = [
  {
    name: "Sophie L.",
    role: "Gestionnaire, 45 lots",
    text: "Depuis MyGestia, je gagne 2 heures par semaine sur la facturation. Les relances automatiques ont réduit mes impayés de 40%.",
    rating: 5,
  },
  {
    name: "Thomas R.",
    role: "SCI familiale, 12 lots",
    text: "Interface claire, prise en main immédiate. La connexion bancaire et le rapprochement automatique, c\u2019est un game-changer.",
    rating: 5,
  },
  {
    name: "Marie D.",
    role: "Cabinet de gestion, 200+ lots",
    text: "On a remplacé 3 outils par MyGestia. L\u2019export FEC pour notre comptable fonctionne parfaitement. Support très réactif.",
    rating: 5,
  },
];

const plans = [
  {
    name: "Starter",
    description: "Pour les petits patrimoines",
    price: 19,
    priceYearly: 190,
    limits: "20 lots · 1 société · 2 utilisateurs",
    features: [
      "Gestion de patrimoine",
      "Baux et locataires",
      "Facturation et quittances PDF",
      "Tableau de bord analytique",
      "Support par email",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    description: "Pour les professionnels",
    price: 79,
    priceYearly: 790,
    limits: "50 lots · 3 sociétés · 5 utilisateurs",
    features: [
      "Tout Starter +",
      "Comptabilité complète & export FEC",
      "Connexion bancaire automatique",
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
    limits: "Lots et sociétés illimités",
    features: [
      "Tout Pro +",
      "Lots et sociétés illimités",
      "Signature électronique",
      "Import IA de documents",
      "Accès API",
      "Support dédié & SLA 99,9%",
    ],
    highlighted: false,
  },
];

const faqs = [
  {
    q: "L\u2019essai gratuit est-il vraiment sans engagement ?",
    a: "Oui. 14 jours d\u2019accès complet, sans carte bancaire. Vous pouvez annuler à tout moment.",
  },
  {
    q: "Puis-je importer mes données existantes ?",
    a: "Oui. MyGestia supporte l\u2019import CSV et Excel pour vos immeubles, lots, locataires et baux.",
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "Absolument. Chiffrement AES-256, authentification 2FA, hébergement en Europe (Frankfurt), audit logs complets et conformité RGPD.",
  },
  {
    q: "Puis-je changer d\u2019offre à tout moment ?",
    a: "Oui. Les upgrades sont immédiats avec prorata. Les downgrades prennent effet à la fin de la période en cours.",
  },
  {
    q: "Proposez-vous un accompagnement à la mise en place ?",
    a: "Les clients Enterprise bénéficient d\u2019un onboarding personnalisé. Pour les autres plans, notre centre d\u2019aide et notre support email sont là pour vous guider.",
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
              Fonctionnalités
            </a>
            <a href="#tarifs" className="text-muted-foreground hover:text-foreground transition-colors">
              Tarifs
            </a>
            <a href="#temoignages" className="text-muted-foreground hover:text-foreground transition-colors">
              Témoignages
            </a>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Se connecter
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-5 py-2 rounded-full mb-8 ring-1 ring-primary/20">
              <Sparkles className="h-4 w-4" />
              Conçu par un multipropriétaire, pour les multipropriétaires
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              Gérez vos biens.
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Pas la paperasse.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Né du terrain, pensé par un multipropriétaire qui connaît vos défis. Patrimoine, baux, facturation, comptabilité, banque — <strong className="text-foreground">tout est centralisé</strong> dans un seul outil moderne et sécurisé.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 h-13 gap-2 shadow-lg shadow-primary/25">
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#fonctionnalites">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-13">
                  Découvrir les fonctionnalités
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Aucune carte bancaire requise · Prêt en 2 minutes
            </p>
          </div>

          {/* Stats bar */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-card border rounded-2xl p-8 shadow-sm">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl sm:text-4xl font-extrabold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof Banner ─── */}
      <section className="border-y bg-muted/40 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" /> Conforme RGPD
            </span>
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Chiffrement AES-256
            </span>
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Hébergé en Europe
            </span>
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Support réactif
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Uptime 99,9%
            </span>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="fonctionnalites" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">Fonctionnalités</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une plateforme complète pour gérer votre patrimoine immobilier de A à Z, sans jongler entre 5 outils.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border bg-card p-8 hover:border-primary/40 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Highlights Banner ─── */}
      <section className="py-16 bg-primary/[0.03] border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {highlights.map((h) => (
              <div key={h.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white flex-shrink-0">
                  <h.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{h.title}</h3>
                  <p className="text-sm text-muted-foreground">{h.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">Démarrage rapide</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5">
              Prêt en 3 étapes
            </h2>
            <p className="text-lg text-muted-foreground">
              Commencez à gérer votre patrimoine en moins de 5 minutes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-primary/20" />
                )}
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-white text-3xl font-extrabold mb-6 shadow-lg shadow-primary/20">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/signup">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/25">
                Commencer maintenant <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="tarifs" className="py-24 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">Tarifs</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5">
              Des tarifs simples et transparents
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              14 jours d&apos;essai gratuit sur toutes les offres. Sans engagement, sans carte bancaire.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
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
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold">{plan.price}</span>
                    <span className="text-xl font-semibold text-muted-foreground">&euro;/mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ou {plan.priceYearly}&euro;/an{" "}
                    <span className="text-primary font-semibold">
                      (-{Math.round((1 - plan.priceYearly / (plan.price * 12)) * 100)}%)
                    </span>
                  </p>
                </div>

                <p className="text-xs font-semibold text-muted-foreground mb-5 pb-5 border-b">
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

                <Link href={plan.name === "Enterprise" ? "/contact" : `/signup?plan=${plan.name.toLowerCase()}`} className="block">
                  <Button
                    className={`w-full h-12 text-sm font-semibold ${plan.highlighted ? "shadow-lg shadow-primary/25" : ""}`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.name === "Enterprise"
                      ? "Contacter l\u2019équipe commerciale"
                      : "Démarrer l\u2019essai gratuit"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="temoignages" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">Témoignages</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5">
              Ils nous font confiance
            </h2>
            <p className="text-lg text-muted-foreground">
              Créé par un propriétaire qui comprend vos contraintes. Adopté par des gestionnaires exigeants.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border bg-card p-8 hover:shadow-lg transition-shadow"
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="pt-4 border-t">
                  <p className="font-bold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 sm:py-32 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm tracking-wide uppercase mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-5">
              Questions fréquentes
            </h2>
          </div>
          <div className="space-y-0">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b last:border-b-0 py-6">
                <h3 className="font-bold mb-2 text-base">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Gradient background instead of flat primary */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white/10,transparent)]" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5 text-white">
            Prêt à simplifier votre gestion ?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Un outil conçu par un multipropriétaire, pour les multipropriétaires. Essai gratuit 14 jours, sans engagement.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-white text-primary hover:bg-white/90 font-bold shadow-xl"
              >
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 bg-white/15 text-white hover:bg-white/25 font-bold border-2 border-white/30"
              >
                Contacter l&apos;équipe
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
                La plateforme SaaS de gestion immobilière pour les professionnels et les SCI.
              </p>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Produit</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <a href="#fonctionnalites" className="block hover:text-foreground transition-colors">
                  Fonctionnalités
                </a>
                <a href="#tarifs" className="block hover:text-foreground transition-colors">
                  Tarifs
                </a>
                <Link href="/locaux" className="block hover:text-foreground transition-colors">
                  Locaux disponibles
                </Link>
                <Link href="/contact" className="block hover:text-foreground transition-colors">
                  Contact
                </Link>
              </div>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Légal</p>
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
                  Confidentialité
                </Link>
                <Link href="/dpa" className="block hover:text-foreground transition-colors">
                  DPA
                </Link>
              </div>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Sécurité</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Chiffrement AES-256
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Conforme RGPD
                </p>
                <p className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Hébergé en Europe
                </p>
                <p className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Paiement sécurisé Stripe
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MTG HOLDING · {APP_NAME}. Tous droits réservés.</p>
            <p>
              Fait avec soin en France
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
