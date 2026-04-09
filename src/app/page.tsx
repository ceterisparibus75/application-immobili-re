import {
  Building2,
  BarChart3,
  FileText,
  Users,
  Shield,
  Banknote,
  ArrowRight,
  Check,
  Clock,
  Lock,
  Globe,
  ChevronRight,
  BadgeCheck,
  TrendingUp,
  Landmark,
  BellRing,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata: Metadata = {
  title: `${APP_NAME} — Logiciel de gestion immobilière pour foncières et gestionnaires`,
  description:
    "Pilotez votre patrimoine immobilier avec rigueur. Baux, facturation, comptabilité FEC, rapprochement bancaire, reporting consolidé. Conforme RGPD, hébergement européen, chiffrement AES-256.",
  openGraph: {
    title: `${APP_NAME} — Logiciel de gestion immobilière pour foncières et gestionnaires`,
    description:
      "Plateforme sécurisée de gestion d'actifs immobiliers. Pilotage, conformité, reporting — conçue pour les foncières privées et les cabinets de gestion.",
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
    icon: FileText,
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
    icon: Banknote,
    title: "Gestion locative complète",
    description:
      "Tous types de baux français, facturation automatique, révisions indicielles IRL/ILC/ILAT, relances programmées.",
  },
  {
    icon: BarChart3,
    title: "Reporting et KPI consolidés",
    description:
      "Tableaux de bord par entité, KPI consolidés (rendement, occupation, LTV), suivi en temps réel de la performance du portefeuille.",
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
    title: "Paramétrage initial",
    description: "Créez vos sociétés, importez votre patrimoine via CSV/Excel. Aucune carte bancaire requise.",
  },
  {
    step: "2",
    title: "Structuration des données",
    description: "Baux, locataires, charges, comptes bancaires — configurez votre environnement de gestion.",
  },
  {
    step: "3",
    title: "Pilotage opérationnel",
    description: "Facturation automatique, rapprochement bancaire, reporting consolidé — votre gestion est en place.",
  },
];

const caseStudies = [
  {
    title: "Optimisation d'un parc de 45 lots en gestion déléguée",
    sector: "Cabinet de gestion",
    challenge: "Processus de facturation manuel chronophage, taux d'impayés élevé faute de relances structurées.",
    solution: "Déploiement de la facturation automatique et du module de relances progressives à trois niveaux.",
    result: "Réduction de 40% des impayés et gain de 2 heures hebdomadaires sur le traitement administratif.",
    author: "Sophie L., Gestionnaire",
  },
  {
    title: "Pilotage consolidé d'une SCI familiale de 12 lots",
    sector: "SCI familiale",
    challenge: "Absence de vision consolidée sur la trésorerie et les encaissements, rapprochements manuels.",
    solution: "Connexion bancaire automatique et rapprochement intelligent des paiements par société.",
    result: "Visibilité en temps réel sur la trésorerie, suppression des erreurs de lettrage.",
    author: "Thomas R., Gérant",
  },
  {
    title: "Remplacement de 3 outils pour un portefeuille de 200+ lots",
    sector: "Foncière privée",
    challenge: "Fragmentation des données entre tableur, logiciel comptable et outil de quittancement.",
    solution: "Migration vers MyGestia : patrimoine, comptabilité FEC et relation locataire unifiés.",
    result: "Un seul référentiel de données, export FEC conforme et reporting consolidé multi-sociétés.",
    author: "Marie D., Directrice de gestion",
  },
];

const plans = [
  {
    name: "Essentiel",
    description: "Patrimoine en gestion directe",
    price: 19,
    priceYearly: 190,
    limits: "20 lots · 1 société · 2 utilisateurs",
    features: [
      "Pilotage du patrimoine",
      "Gestion des baux et locataires",
      "Facturation et quittances PDF",
      "Tableau de bord analytique",
      "Support par email",
    ],
    highlighted: false,
  },
  {
    name: "Professionnel",
    description: "Cabinets et multi-sociétés",
    price: 79,
    priceYearly: 790,
    limits: "50 lots · 3 sociétés · 5 utilisateurs",
    features: [
      "Tout Essentiel +",
      "Comptabilité intégrée & export FEC",
      "Rapprochement bancaire automatique",
      "Recouvrement par relances progressives",
      "Portail locataire sécurisé",
      "Support prioritaire",
    ],
    highlighted: true,
  },
  {
    name: "Institutionnel",
    description: "Foncières et grands portefeuilles",
    price: 199,
    priceYearly: 1990,
    limits: "Lots et sociétés illimités",
    features: [
      "Tout Professionnel +",
      "Lots et sociétés illimités",
      "Signature électronique",
      "Import documentaire assisté",
      "Accès API & intégrations",
      "Support dédié & SLA 99,9%",
    ],
    highlighted: false,
  },
];

const faqs = [
  {
    q: "La période d'évaluation est-elle sans engagement ?",
    a: "Oui. 14 jours d'accès complet à l'ensemble des fonctionnalités, sans carte bancaire. Aucun engagement contractuel.",
  },
  {
    q: "Est-il possible de migrer nos données existantes ?",
    a: "MyGestia permet l'import structuré via CSV et Excel : immeubles, lots, locataires, baux et écritures comptables.",
  },
  {
    q: "Quelle est la politique de sécurité des données ?",
    a: "Chiffrement AES-256-GCM pour les données bancaires, authentification multifacteur, audit logs exhaustifs, hébergement européen (Frankfurt) et conformité RGPD native. Consultez notre page Sécurité & Conformité pour le détail.",
  },
  {
    q: "L'export FEC est-il conforme aux exigences fiscales ?",
    a: "Le Fichier des Écritures Comptables est généré nativement au format requis par l'administration fiscale française, prêt à transmettre à votre expert-comptable.",
  },
  {
    q: "Proposez-vous un accompagnement au déploiement ?",
    a: "Les clients Institutionnel bénéficient d'un onboarding personnalisé avec un interlocuteur dédié. Les autres plans disposent d'une documentation complète et d'un support par email.",
  },
  {
    q: "Puis-je gérer plusieurs sociétés et structures juridiques ?",
    a: "Oui. MyGestia est conçu pour le multi-sociétés. Chaque structure (SCI, SARL, SAS) dispose de sa propre comptabilité, avec consolidation au niveau propriétaire.",
  },
];

/* ─── JSON-LD Structured Data ──────────────────────────────────────── */

const SITE_URL = process.env.AUTH_URL ?? "https://app.mygestia.immo";

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MTG HOLDING",
  brand: { "@type": "Brand", name: APP_NAME },
  url: SITE_URL,
  logo: `${SITE_URL}/logo-mygestia.svg`,
  description: "Plateforme sécurisée de gestion d'actifs immobiliers pour les foncières privées, les cabinets de gestion et les family offices.",
  address: { "@type": "PostalAddress", addressCountry: "FR" },
};

const jsonLdSoftware = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: plans.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: p.price,
    priceCurrency: "EUR",
    description: p.description,
  })),
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "47",
  },
};

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      {/* ─── Navbar ─── */}
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

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-white">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(27,79,138,0.08),transparent)]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-cyan)]/[0.04] rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full mb-8 ring-1 ring-[var(--color-brand-cyan)]/20">
              <Shield className="h-4 w-4" />
              Plateforme sécurisée de gestion d&apos;actifs immobiliers
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-[var(--color-brand-deep)]">
              La maîtrise de votre
              <br />
              <span className="text-brand-gradient">
                patrimoine immobilier.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Plateforme unifiée pour la consolidation, l&apos;analyse et la sécurisation des actifs immobiliers. Conçue pour les environnements multi-entités exigeants.
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
              Déploiement accompagné pour les multipropriétaires
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

      {/* ─── Social Proof Banner ─── */}
      <section className="border-y border-border/60 bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Conformité RGPD
            </span>
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--color-brand-blue)]" /> Chiffrement AES-256-GCM
            </span>
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--color-brand-cyan)]" /> Hébergement souverain UE
            </span>
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--color-brand-blue)]" /> Export FEC conforme
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-brand-cyan)]" /> SLA 99,9%
            </span>
          </div>
        </div>
      </section>

      {/* ─── Le constat ─── */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Le constat</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Un pilotage encore fragmenté
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Les portefeuilles immobiliers reposent souvent sur des systèmes disjoints : données locataires séparées de la comptabilité, absence de vision consolidée multi-sociétés, reporting construit manuellement. Cette fragmentation limite la capacité de pilotage et de contrôle.
          </p>
        </div>
      </section>

      {/* ─── Notre approche ─── */}
      <section className="py-24 sm:py-32 bg-[#F9FAFB] border-y border-border/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Notre approche</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
            Une infrastructure centrale de gestion et de contrôle
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            La plateforme constitue un système unique de consolidation et de pilotage du patrimoine immobilier. Elle structure l&apos;information autour de trois axes stratégiques : actifs, flux financiers et conformité opérationnelle.
          </p>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="fonctionnalites" className="py-24 sm:py-32 bg-white">
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
              Opérationnel en 3 étapes
            </h2>
            <p className="text-lg text-muted-foreground">
              Un déploiement progressif et structuré, adapté à la complexité de votre patrimoine.
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
            <Link href="/signup">
              <Button size="lg" className="gap-2 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg shadow-brand-lg">
                Démarrer l&apos;évaluation <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="tarifs" className="py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Offres</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Une tarification lisible et prévisible
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              14 jours d&apos;évaluation complète sur toutes les offres. Sans engagement, sans carte bancaire.
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
                    <span className="text-5xl font-bold text-[var(--color-brand-deep)]">{plan.price}</span>
                    <span className="text-xl font-semibold text-muted-foreground">&euro;/mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ou {plan.priceYearly}&euro;/an{" "}
                    <span className="text-[var(--color-brand-cyan)] font-semibold">
                      (-{Math.round((1 - plan.priceYearly / (plan.price * 12)) * 100)}%)
                    </span>
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

                <Link href={plan.name === "Institutionnel" ? "/contact" : `/signup?plan=${plan.name.toLowerCase()}`} className="block">
                  <Button
                    className={`w-full h-12 text-sm font-semibold rounded-lg ${
                      plan.highlighted
                        ? "bg-brand-gradient-soft hover:opacity-90 text-white shadow-brand"
                        : "border-[var(--color-brand-blue)]/20 text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-light)]"
                    }`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.name === "Institutionnel"
                      ? "Contacter l\u2019équipe commerciale"
                      : "Démarrer l\u2019évaluation"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Solutions (Segmentation) ─── */}
      <section id="solutions" className="py-24 sm:py-32 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Solutions</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Une réponse adaptée à chaque métier
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Que vous pilotiez un patrimoine familial ou gériez pour compte de tiers, MyGestia s&apos;adapte à vos exigences opérationnelles.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Foncières & Family Offices */}
            <div className="rounded-xl border border-border/60 bg-white p-8 shadow-brand hover:shadow-brand-lg transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient-soft text-white mb-6">
                <Landmark className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-brand-deep)] mb-2">Pour les Foncières & Family Offices</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Pilotez le rendement de vos actifs avec une vision consolidée, multi-sociétés et multi-structures juridiques.
              </p>
              <ul className="space-y-3">
                {[
                  "Vision consolidée du patrimoine et de la trésorerie",
                  "Rendement brut, LTV et taux d'occupation en temps réel",
                  "Reporting propriétaire multi-sociétés",
                  "Gestion des emprunts et de l'amortissement",
                  "Préparation à la transmission patrimoniale",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[var(--color-brand-cyan)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/signup">
                  <Button className="w-full bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg">
                    Évaluer la solution <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Professionnels de la Gestion */}
            <div className="rounded-xl border border-border/60 bg-white p-8 shadow-brand hover:shadow-brand-lg transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient-soft text-white mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-brand-deep)] mb-2">Pour les Professionnels de la Gestion</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Automatisez vos flux opérationnels et structurez la relation locataire avec rigueur et traçabilité.
              </p>
              <ul className="space-y-3">
                {[
                  "Facturation et quittancement automatisés",
                  "Recouvrement par relances progressives",
                  "Portail locataire sécurisé avec documents",
                  "Comptabilité intégrée et export FEC conforme",
                  "Rapprochement bancaire et suivi de trésorerie",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[var(--color-brand-cyan)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/signup">
                  <Button className="w-full bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg">
                    Évaluer la solution <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Case Studies ─── */}
      <section id="etudes-de-cas" className="py-24 sm:py-32 bg-white border-t border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Études de cas</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-brand-deep)] mb-5">
              Retours d&apos;expérience clients
            </h2>
            <p className="text-lg text-muted-foreground">
              Des résultats mesurables, obtenus par des professionnels exigeants.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {caseStudies.map((cs) => (
              <div
                key={cs.title}
                className="rounded-xl border border-border/60 bg-[#F9FAFB] p-8 shadow-brand hover:shadow-brand-lg transition-shadow flex flex-col"
              >
                <div className="inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] mb-4 self-start">
                  {cs.sector}
                </div>
                <h3 className="text-base font-bold text-[var(--color-brand-deep)] mb-4 leading-snug">{cs.title}</h3>
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Enjeu</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cs.challenge}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Solution</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cs.solution}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Résultat</p>
                    <p className="text-sm font-medium text-[var(--color-brand-deep)] leading-relaxed">{cs.result}</p>
                  </div>
                </div>
                <div className="pt-4 mt-4 border-t border-border/60">
                  <p className="text-xs text-muted-foreground">{cs.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 sm:py-32 bg-white">
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
            Prêt à structurer votre gestion immobilière ?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Évaluez MyGestia pendant 14 jours. Aucun engagement, aucune carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-white text-[var(--color-brand-deep)] hover:bg-white/90 font-bold rounded-lg shadow-xl"
              >
                Démarrer l&apos;évaluation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 bg-white/15 text-white hover:bg-white/25 font-bold border-2 border-white/30 rounded-lg"
              >
                Demander une présentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
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
    </div>
  );
}
