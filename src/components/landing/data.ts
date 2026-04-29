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
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.mygestia.immo";

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
  { value: "20-300 lots", label: "cible portefeuille idéale" },
  { value: "Multi-sociétés", label: "SCI, holdings et entités dédiées" },
  { value: "FEC + PA 2026", label: "comptabilité et e-facturation" },
  { value: "Banque", label: "rapprochement et trésorerie" },
];

export const features: Feature[] = [
  {
    icon: Building2,
    title: "Vision multi-entités",
    description:
      "Structurez chaque SCI, SARL ou entité dédiée sans perdre la vision propriétaire : actifs, loyers, dette, trésorerie et alertes consolidés.",
  },
  {
    icon: FileText,
    title: "Rigueur comptable",
    description:
      "Plan comptable immobilier, écritures validées, export FEC, pièces justificatives et rapprochement bancaire dans un même référentiel exploitable par l'expert-comptable.",
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
      "Tous types de baux français, facturation automatique, révisions indicielles IRL/ILC/ILAT, relances et portail locataire pour la gestion courante.",
  },
  {
    icon: Building,
    title: "Charges et copropriété",
    description:
      "Suivi des charges récupérables, provisions, clés de répartition, appels et justificatifs pour fiabiliser les régularisations.",
  },
  {
    icon: CalendarRange,
    title: "Locations spécifiques",
    description:
      "Baux commerciaux, professionnels, habitation, parkings et usages particuliers : un modèle assez souple pour les portefeuilles mixtes.",
  },
  {
    icon: Bot,
    title: "Assistant IA intégré",
    description:
      "Chatbot conversationnel, génération automatique de courriers, prédiction des impayés et analyse documentaire assistée par intelligence artificielle.",
  },
  {
    icon: Workflow,
    title: "Automatisation opérationnelle",
    description:
      "Crons métier, relances, alertes diagnostics, assurances, baux, rapports et révisions pour réduire les tâches récurrentes.",
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
      "Tableaux de bord par entité et au niveau propriétaire : rendement, occupation, impayés, LTV, dette, trésorerie et échéances.",
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
    title: "Diagnostic du portefeuille",
    description: "Identifiez vos sociétés, lots, baux, comptes bancaires et priorités de reprise. Un compte démo permet de tester sans partir de zéro.",
  },
  {
    step: "2",
    title: "Migration guidée",
    description: "Importez un bail PDF avec l'IA ou saisissez progressivement immeubles, lots, locataires et soldes d'ouverture.",
  },
  {
    step: "3",
    title: "Pilotage consolidé",
    description: "Activez facturation, banque, comptabilité et reporting propriétaire pour piloter chaque entité sans tableur parallèle.",
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
    description: "SCI et patrimoine en gestion directe",
    price: 19,
    priceYearly: 190,
    limits: "20 lots · 1 société · 2 utilisateurs",
    features: [
      "Pilotage du patrimoine",
      "Gestion des baux et locataires",
      "Facturation et quittances PDF",
      "Charges et régularisations",
      "Dossier documentaire",
      "Import guidé du premier bail",
      "Tableau de bord analytique",
      "Support par email",
    ],
    highlighted: false,
  },
  {
    name: "Professionnel",
    description: "Multi-sociétés et portefeuilles structurés",
    price: 79,
    priceYearly: 790,
    limits: "50 lots · 3 sociétés · 5 utilisateurs",
    features: [
      "Tout Essentiel +",
      "Comptabilité intégrée & export FEC",
      "Rapprochement bancaire automatique",
      "Recouvrement par relances progressives",
      "Portail locataire sécurisé",
      "Reporting propriétaire consolidé",
      "Support prioritaire",
    ],
    highlighted: true,
  },
  {
    name: "Institutionnel",
    description: "Foncières, family offices et grands portefeuilles",
    price: 199,
    priceYearly: 1990,
    limits: "Lots et sociétés illimités",
    features: [
      "Tout Professionnel +",
      "Lots et sociétés illimités",
      "Assistant IA (chatbot, courriers, prédiction)",
      "Signature électronique",
      "Import documentaire assisté par IA",
      "Facturation électronique B2B 2026",
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
    a: "Oui. Vous pouvez explorer un compte démo, importer un bail PDF avec vérification assistée par IA, puis compléter progressivement immeubles, lots, locataires, soldes d'ouverture et comptes bancaires.",
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
  {
    q: "Quelles fonctionnalités sont réservées au plan Institutionnel ?",
    a: "Le plan Institutionnel inclut : lots et sociétés illimités, assistant IA (chatbot, génération de courriers, prédiction des impayés), signature électronique, import documentaire assisté par IA, accès API et support dédié avec SLA 99,9%.",
  },
  {
    q: "À partir de quand MyGestia est-il pertinent ?",
    a: "Pour un seul logement, un outil bailleur léger peut suffire. MyGestia vise surtout les SCI, holdings, foncières privées et gestionnaires qui doivent consolider plusieurs lots, sociétés, flux bancaires et obligations comptables.",
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
  description: "Plateforme sécurisée de pilotage immobilier multi-sociétés pour SCI, holdings patrimoniales, foncières privées et family offices.",
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
