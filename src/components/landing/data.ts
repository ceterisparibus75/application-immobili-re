import {
  Building2,
  BarChart3,
  FileText,
  Users,
  Shield,
  Banknote,
  BellRing,
  TrendingUp,
  Receipt,
  Bot,
  Building,
  CalendarRange,
  Workflow,
  UserSearch,
} from "lucide-react";
import type { ElementType } from "react";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";
export const SITE_URL = process.env.AUTH_URL ?? "https://app.mygestia.immo";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface Stat {
  value: string;
  label: string;
}

export interface Feature {
  icon: ElementType;
  title: string;
  description: string;
}

export interface Highlight {
  icon: ElementType;
  title: string;
  description: string;
}

export interface Step {
  step: string;
  title: string;
  description: string;
}

export interface CaseStudy {
  title: string;
  sector: string;
  challenge: string;
  solution: string;
  result: string;
  author: string;
}

export interface Plan {
  name: string;
  description: string;
  price: number;
  priceYearly: number;
  limits: string;
  features: string[];
  highlighted: boolean;
}

export interface Faq {
  q: string;
  a: string;
}

/* ─── Data ──────────────────────────────────────────────────────────── */

export const stats: Stat[] = [
  { value: "Multi-entités", label: "consolidation en temps réel" },
  { value: "AES-256", label: "chiffrement des données" },
  { value: "99,9%", label: "de disponibilité" },
  { value: "RGPD", label: "conformité native" },
];

export const features: Feature[] = [
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
    icon: Building,
    title: "Copropriété",
    description:
      "Gestion des copropriétés, suivi des charges et appels de fonds, répartition par tantièmes et pilotage des assemblées générales.",
  },
  {
    icon: CalendarRange,
    title: "Location saisonnière",
    description:
      "Module dédié à la gestion des locations courte durée : calendrier de disponibilité, tarification dynamique et suivi des réservations.",
  },
  {
    icon: Bot,
    title: "Assistant IA intégré",
    description:
      "Chatbot conversationnel, génération automatique de courriers, prédiction des impayés et analyse documentaire assistée par intelligence artificielle.",
  },
  {
    icon: Workflow,
    title: "Automatisation par workflows",
    description:
      "Créez des workflows personnalisés pour automatiser vos processus récurrents : relances, notifications, affectations et validations.",
  },
  {
    icon: UserSearch,
    title: "CRM & Candidatures",
    description:
      "Centralisez et qualifiez les candidatures locataires. Suivi du pipeline, scoring des dossiers et communication intégrée.",
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

export const highlights: Highlight[] = [
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

export const steps: Step[] = [
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

export const caseStudies: CaseStudy[] = [
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

export const plans: Plan[] = [
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
      "Copropriété",
      "Location saisonnière",
      "CRM & Candidatures",
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
      "Workflows & automatisations",
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
      "Assistant IA (chatbot, courriers, prédiction)",
      "Signature électronique",
      "Import documentaire assisté par IA",
      "Accès API & intégrations",
      "Support dédié & SLA 99,9%",
    ],
    highlighted: false,
  },
];

export const faqs: Faq[] = [
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

/* ─── JSON-LD ───────────────────────────────────────────────────────── */

export const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MTG HOLDING",
  brand: { "@type": "Brand", name: APP_NAME },
  url: SITE_URL,
  logo: `${SITE_URL}/logo-mygestia.svg`,
  description: "Plateforme sécurisée de gestion d'actifs immobiliers pour les foncières privées, les cabinets de gestion et les family offices.",
  address: { "@type": "PostalAddress", addressCountry: "FR" },
};

export const jsonLdSoftware = {
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

export const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
