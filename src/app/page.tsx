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
  title: `${APP_NAME} — Infrastructure de pilotage du patrimoine immobilier`,
  description:
    "Plateforme unifiée pour la consolidation, l\u2019analyse et la sécurisation des actifs immobiliers. Conçue pour les foncières, family offices et opérateurs multi-sociétés.",
  openGraph: {
    title: `${APP_NAME} — Infrastructure de pilotage du patrimoine immobilier`,
    description:
      "Plateforme unifiée pour la consolidation, l\u2019analyse et la sécurisation des actifs immobiliers. Conçue pour les foncières, family offices et opérateurs multi-sociétés.",
    type: "website",
  },
};

/* ─── Data ─────────────────────────────────────────────────────────────── */

const stats = [
  { value: "Multi-entités", label: "consolidation en temps réel" },
  { value: "AES-256", label: "chiffrement des données" },
  { value: "99,9%", label: "de disponibilité" },
  { value: "RGPD", label: "conformité native" },
];

const features = [
  {
    icon: Building2,
    title: "Vision multi-entités",
    description:
      "Suivi des immeubles, traçabilité des diagnostics, structuration par société et portefeuille. Consolidation transversale de l\u2019ensemble des actifs.",
  },
  {
    icon: Banknote,
    title: "Rigueur comptable",
    description:
      "Plan comptable immobilier intégré, export FEC conforme, rapprochement bancaire automatisé. Chaque écriture est tracée et auditable.",
  },
  {
    icon: Users,
    title: "Relation locataire structurée",
    description:
      "Portail sécurisé pour les locataires, facturation automatisée, centralisation documentaire. Communication maîtrisée et traçable.",
  },
  {
    icon: BarChart3,
    title: "Reporting et KPI consolidés",
    description:
      "Tableaux de bord par entité, KPI consolidés (rendement, occupation, LTV), suivi en temps réel de la performance du portefeuille.",
  },
  {
    icon: FileText,
    title: "Gestion locative complète",
    description:
      "Tous types de baux français, facturation automatique, révisions indicielles IRL/ILC/ILAT, relances programmées.",
  },
  {
    icon: Shield,
    title: "Environnement sécurisé et conforme",
    description:
      "Chiffrement AES-256-GCM, authentification multifactorielle, logs d\u2019audit exhaustifs, conformité RGPD native, infrastructure hébergée en Europe.",
  },
];

const highlights = [
  {
    icon: BellRing,
    title: "Alertes et suivi proactif",
    description: "Échéances de bail, diagnostics, assurances, impayés — rien n\u2019échappe au système.",
  },
  {
    icon: TrendingUp,
    title: "Révisions indicielles automatisées",
    description: "Indices IRL/ILC/ILAT synchronisés depuis l\u2019INSEE. Détection et calcul automatique.",
  },
  {
    icon: Receipt,
    title: "Export comptable normalisé",
    description: "Fichier des Écritures Comptables conforme, prêt pour transmission à vos équipes comptables.",
  },
];

const steps = [
  {
    step: "1",
    title: "Audit et cadrage",
    description: "Analyse de votre structure patrimoniale et définition du périmètre de déploiement.",
  },
  {
    step: "2",
    title: "Paramétrage et import",
    description: "Configuration multi-sociétés, import des données existantes et intégrations bancaires.",
  },
  {
    step: "3",
    title: "Pilotage opérationnel",
    description: "Consolidation des actifs, automatisation des flux et reporting en temps réel.",
  },
];

const testimonials = [
  {
    name: "Directeur de gestion",
    role: "Foncière privée, 180 lots",
    text: "MyGestia a unifié nos quatre outils en une seule plateforme. La consolidation multi-sociétés et l\u2019export FEC nous font gagner un temps considérable chaque trimestre.",
    rating: 5,
  },
  {
    name: "Gestionnaire patrimonial",
    role: "Family office, 3 sociétés",
    text: "La structuration par entité et le rapprochement bancaire automatisé ont transformé notre reporting. Nos associés ont enfin une vision claire et en temps réel.",
    rating: 5,
  },
  {
    name: "Responsable opérationnel",
    role: "Opérateur multi-sites, 250+ lots",
    text: "L\u2019intégrité des données et la traçabilité complète étaient nos priorités. MyGestia répond à ces exigences avec un niveau de rigueur que nous n\u2019avions pas trouvé ailleurs.",
    rating: 5,
  },
];

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
    highlighted: false,
  },
];

const faqs = [
  {
    q: "À qui s\u2019adresse MyGestia ?",
    a: "MyGestia est conçu pour les foncières privées, family offices, investisseurs institutionnels et opérateurs multi-sociétés qui ont besoin d\u2019une infrastructure de pilotage fiable et consolidée.",
  },
  {
    q: "Comment se déroule le déploiement ?",
    a: "Après un audit de votre structure patrimoniale, nous configurons la plateforme selon votre organisation (sociétés, portefeuilles, droits d\u2019accès). L\u2019import de vos données existantes est accompagné.",
  },
  {
    q: "Quel est le niveau de sécurité de la plateforme ?",
    a: "Chiffrement AES-256-GCM sur les données sensibles, authentification multifactorielle, logs d\u2019audit complets, conformité RGPD native. Infrastructure hébergée en Europe (Frankfurt).",
  },
  {
    q: "La plateforme s\u2019intègre-t-elle à nos outils existants ?",
    a: "Oui. Connexion bancaire automatique, export FEC pour la comptabilité, API d\u2019accès pour les plans Infrastructure. Import CSV/Excel pour la reprise de données.",
  },
  {
    q: "Proposez-vous un accompagnement personnalisé ?",
    a: "Chaque déploiement est accompagné. Les clients Infrastructure bénéficient d\u2019un onboarding dédié avec un interlocuteur unique. Un support prioritaire est disponible sur tous les plans.",
  },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-9" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#fonctionnalites" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
              Plateforme
            </a>
            <a href="#tarifs" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
              Offres
            </a>
            <a href="#temoignages" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
              Références
            </a>
            <Link href="/contact" className="text-muted-foreground hover:text-[var(--color-brand-deep)] transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[var(--color-brand-deep)] font-semibold">
                Accès client
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="sm" className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg">
                Demander une démonstration <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-white">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(27,79,138,0.08),transparent)]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-cyan)]/[0.04] rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full mb-8 ring-1 ring-[var(--color-brand-cyan)]/20">
              <Sparkles className="h-4 w-4" />
              Foncières \u00b7 Family Offices \u00b7 Opérateurs multi-sociétés
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-[var(--color-brand-deep)]">
              Infrastructure de pilotage
              <br />
              <span className="text-brand-gradient">
                du patrimoine immobilier
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Plateforme unifiée pour la consolidation, l&apos;analyse et la sécurisation des actifs immobiliers. Conçue pour les environnements <strong className="text-[var(--color-brand-deep)]">multi-entités exigeants</strong>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
              <Link href="/contact">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg shadow-brand-lg">
                  Demander une démonstration
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#fonctionnalites">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-13 rounded-lg border-[var(--color-brand-blue)]/20 text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-light)]">
                  Découvrir la plateforme
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Déploiement accompagné \u00b7 Tarification sur audit
            </p>
          </div>

          {/* Stats bar */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-white border border-border/60 rounded-xl p-8 shadow-brand">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold text-brand-gradient">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Problématique ─── */}
      <section className="border-y border-border/60 bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Le constat</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
              Un pilotage encore fragmenté
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Les portefeuilles immobiliers reposent souvent sur des systèmes disjoints : données locataires séparées de la comptabilité, absence de vision consolidée multi-sociétés, reporting construit manuellement. Cette fragmentation limite la capacité de pilotage et de contrôle.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Positionnement ─── */}
      <section className="py-16 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Notre approche</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
              Une infrastructure centrale de gestion et de contrôle
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              La plateforme constitue un système unique de consolidation et de pilotage du patrimoine immobilier. Elle structure l&apos;information autour de trois axes stratégiques : actifs, flux financiers et conformité opérationnelle.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="fonctionnalites" className="py-24 sm:py-32 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Plateforme</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Capacités clés
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une infrastructure complète pour structurer, piloter et sécuriser la gestion de votre patrimoine immobilier.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-xl border border-border/60 bg-white p-8 shadow-brand hover:shadow-brand-lg hover:border-[var(--color-brand-cyan)]/30 transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient-soft text-white mb-5 group-hover:scale-105 transition-transform duration-300">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Highlights Banner ─── */}
      <section className="py-16 bg-white border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {highlights.map((h) => (
              <div key={h.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient text-white flex-shrink-0">
                  <h.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-brand-deep)] mb-1">{h.title}</h3>
                  <p className="text-sm text-muted-foreground">{h.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-24 sm:py-32 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Déploiement</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Mise en place accompagnée
            </h2>
            <p className="text-lg text-muted-foreground">
              Un processus structuré pour un déploiement maîtrisé.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-[var(--color-brand-cyan)]/30" />
                )}
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-xl bg-brand-gradient text-white text-3xl font-bold mb-6 shadow-brand-lg">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/contact">
              <Button size="lg" className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg shadow-brand-lg">
                Organiser un échange <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Sécurité & Conformité ─── */}
      <section className="border-y border-border/60 bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--color-brand-blue)]" /> Chiffrement AES-256-GCM
            </span>
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Authentification multifactorielle
            </span>
            <span className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Conformité RGPD native
            </span>
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--color-brand-blue)]" /> Infrastructure européenne
            </span>
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Logs d&apos;audit exhaustifs
            </span>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="tarifs" className="py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Offres</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Tarification adaptée à votre structure
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Chaque déploiement fait l&apos;objet d&apos;un audit préalable pour dimensionner l&apos;offre à vos besoins réels.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-8 flex flex-col bg-white transition-all duration-300 ${
                  plan.highlighted
                    ? "border-[var(--color-brand-cyan)] shadow-brand-lg ring-2 ring-[var(--color-brand-cyan)]/30 relative md:-mt-4 md:mb-4"
                    : "border-border/60 shadow-brand hover:shadow-brand-lg"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-gradient-soft text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-brand">
                    Recommandé
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[var(--color-brand-deep)]">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[var(--color-brand-deep)]">{plan.priceLabel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tarification annuelle personnalisée
                  </p>
                </div>

                <p className="text-xs font-semibold text-muted-foreground mb-5 pb-5 border-b border-border/60">
                  {plan.limits}
                </p>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check className="h-4 w-4 text-[var(--color-brand-cyan)] mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/contact" className="block">
                  <Button
                    className={`w-full h-12 text-sm font-semibold rounded-lg ${
                      plan.highlighted
                        ? "bg-brand-gradient-soft hover:opacity-90 text-white shadow-brand"
                        : "border-[var(--color-brand-blue)]/20 text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-light)]"
                    }`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    Demander une démonstration
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="temoignages" className="py-24 sm:py-32 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Références</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Adoptée par des opérateurs exigeants
            </h2>
            <p className="text-lg text-muted-foreground">
              Retours d&apos;expérience de professionnels du patrimoine immobilier.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border border-border/60 bg-white p-8 shadow-brand hover:shadow-brand-lg transition-shadow"
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
                <div className="pt-4 border-t border-border/60">
                  <p className="font-semibold text-sm text-[var(--color-brand-deep)]">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Cible ─── */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Vision</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
            Une source unique de vérité immobilière
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            MyGestia n&apos;est pas un simple outil de gestion locative. C&apos;est une infrastructure de pilotage conçue pour des environnements exigeants où la rigueur, la consolidation et la conformité ne sont pas négociables.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full ring-1 ring-[var(--color-brand-cyan)]/20">
              Foncières privées
            </span>
            <span className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full ring-1 ring-[var(--color-brand-cyan)]/20">
              Family offices
            </span>
            <span className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full ring-1 ring-[var(--color-brand-cyan)]/20">
              Investisseurs institutionnels
            </span>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 sm:py-32 bg-[#F9FAFB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
              Questions fréquentes
            </h2>
          </div>
          <div className="space-y-0">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-border/60 last:border-b-0 py-6">
                <h3 className="font-semibold text-[var(--color-brand-deep)] mb-2 text-base">{faq.q}</h3>
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
        <div className="absolute inset-0 bg-brand-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent)]" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5 text-white">
            Structurez le pilotage de votre patrimoine
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Une infrastructure conçue pour les opérateurs qui exigent rigueur, consolidation et conformité.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/contact">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-white text-[var(--color-brand-deep)] hover:bg-white/90 font-bold rounded-lg shadow-xl"
              >
                Demander une démonstration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 bg-white/15 text-white hover:bg-white/25 font-bold border-2 border-white/30 rounded-lg"
              >
                Organiser un échange
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/60 py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-8" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Infrastructure de pilotage du patrimoine immobilier pour les foncières, family offices et opérateurs multi-sociétés.
              </p>
            </div>

            <div>
              <p className="font-semibold text-sm mb-4">Plateforme</p>
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <a href="#fonctionnalites" className="block hover:text-foreground transition-colors">
                  Capacités
                </a>
                <a href="#tarifs" className="block hover:text-foreground transition-colors">
                  Offres
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
                  <Lock className="h-3.5 w-3.5" /> Chiffrement AES-256-GCM
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Conforme RGPD
                </p>
                <p className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Infrastructure européenne
                </p>
                <p className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Paiement sécurisé Stripe
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t flex justify-center items-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MTG HOLDING \u00b7 {APP_NAME}. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
